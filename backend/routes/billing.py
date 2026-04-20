import json
import os
from datetime import datetime

import stripe
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from models import AppSetting, db, User
from services.email_service import (
    send_failed_payment_email,
    send_invoice_receipt_email,
    send_payment_confirmation_email,
)
from utils.access_control import ACTIVE_SUBSCRIPTION_STATUSES, get_effective_tier, normalize_tier


billing_bp = Blueprint("billing", __name__)

STRIPE_SECRET_KEY_SETTING = "stripe_secret_key"
STRIPE_WEBHOOK_SECRET_SETTING = "stripe_webhook_secret"
STRIPE_PRICE_PLAN_SETTING = "stripe_price_plan_monthly"
STRIPE_PRICE_THRIVE_SETTING = "stripe_price_thrive_monthly"
STRIPE_PRICE_TOGETHER_SETTING = "stripe_price_together_monthly"
STRIPE_TRIAL_DAYS_SETTING = "stripe_trial_days_default"
STRIPE_FRONTEND_URL_SETTING = "stripe_frontend_base_url"

PLAN_DEFINITIONS = {
    "plan": {
        "id": "plan",
        "name": "Plan",
        "price_monthly": 9.99,
        "description": "Basic help for weekly homeschool life.",
        "price_env_key": "STRIPE_PRICE_PLAN_MONTHLY",
        "price_setting_key": STRIPE_PRICE_PLAN_SETTING,
    },
    "thrive": {
        "id": "thrive",
        "name": "Thrive",
        "price_monthly": 19.99,
        "description": "Includes Plan features + deeper child support.",
        "price_env_key": "STRIPE_PRICE_THRIVE_MONTHLY",
        "price_setting_key": STRIPE_PRICE_THRIVE_SETTING,
    },
    "together": {
        "id": "together",
        "name": "Together",
        "price_monthly": 49.00,
        "description": "Includes Plan + Thrive + coaching/community features.",
        "price_env_key": "STRIPE_PRICE_TOGETHER_MONTHLY",
        "price_setting_key": STRIPE_PRICE_TOGETHER_SETTING,
    },
}


def get_stripe_client():
    secret_key = get_setting_value(STRIPE_SECRET_KEY_SETTING, env_fallback_key="STRIPE_SECRET_KEY")
    if not secret_key:
        raise RuntimeError("Missing STRIPE_SECRET_KEY")
    stripe.api_key = secret_key
    return stripe


def get_current_user():
    user_id = get_user_id()
    return User.query.get(user_id)


def is_admin_user(user=None):
    user = user or get_current_user()
    return bool(user and user.is_admin)


def get_setting_row(setting_key):
    return AppSetting.query.filter_by(setting_key=setting_key).first()


def get_setting_value(setting_key, default="", env_fallback_key=None):
    row = get_setting_row(setting_key)
    if row and row.setting_value is not None and str(row.setting_value).strip() != "":
        return row.setting_value.strip()

    if env_fallback_key:
        return (os.environ.get(env_fallback_key) or default).strip() if isinstance(default, str) else os.environ.get(env_fallback_key, default)

    return default


def upsert_setting_value(setting_key, value):
    value = "" if value is None else str(value).strip()
    row = get_setting_row(setting_key)
    if not row:
        row = AppSetting(setting_key=setting_key, setting_value=value)
        db.session.add(row)
    else:
        row.setting_value = value
    return row


def get_user_id():
    user_id = get_jwt_identity()
    if isinstance(user_id, str):
        user_id = int(user_id)
    return user_id


def frontend_base_url():
    return (
        get_setting_value(STRIPE_FRONTEND_URL_SETTING, env_fallback_key="FRONTEND_BASE_URL", default="http://localhost:5500")
        or "http://localhost:5500"
    ).rstrip("/")


def plan_id_for_price(price_id):
    if not price_id:
        return None
    normalized = str(price_id).strip()
    for plan_id, plan in PLAN_DEFINITIONS.items():
        configured_price = get_setting_value(plan["price_setting_key"], env_fallback_key=plan["price_env_key"])
        if configured_price and configured_price == normalized:
            return plan_id
    return None


def price_id_for_plan(plan_id):
    plan = PLAN_DEFINITIONS.get(normalize_tier(plan_id))
    if not plan:
        return None
    return get_setting_value(plan["price_setting_key"], env_fallback_key=plan["price_env_key"])


def plan_name(plan_id):
    plan = PLAN_DEFINITIONS.get(normalize_tier(plan_id))
    return plan["name"] if plan else "Plan"


def amount_to_text(amount_in_cents, currency="usd"):
    if amount_in_cents is None:
        return "N/A"
    return f"{(amount_in_cents / 100):.2f} {str(currency or 'usd').upper()}"


def resolve_user_by_customer_or_metadata(customer_id=None, metadata=None):
    user = None
    if customer_id:
        user = User.query.filter_by(stripe_customer_id=customer_id).first()
    if user:
        return user

    metadata = metadata or {}
    raw_user_id = metadata.get("user_id")
    if raw_user_id:
        try:
            return User.query.get(int(raw_user_id))
        except (TypeError, ValueError):
            return None
    return None


def sync_user_from_subscription(subscription, user=None):
    if not subscription:
        return None

    customer_id = subscription.get("customer")
    metadata = subscription.get("metadata") or {}
    user = user or resolve_user_by_customer_or_metadata(customer_id, metadata)
    if not user:
        return None

    user.stripe_customer_id = customer_id
    user.stripe_subscription_id = subscription.get("id")
    status = (subscription.get("status") or "inactive").lower()
    user.subscription_status = status

    resolved_plan_id = None
    items = ((subscription.get("items") or {}).get("data") or [])
    if items:
        price_id = ((items[0].get("price") or {}).get("id"))
        resolved_plan_id = plan_id_for_price(price_id)

    if not resolved_plan_id:
        resolved_plan_id = normalize_tier(metadata.get("plan_id") or user.subscription_tier)

    if status in ACTIVE_SUBSCRIPTION_STATUSES:
        user.subscription_tier = normalize_tier(resolved_plan_id)
    else:
        user.subscription_tier = "free"

    trial_end_ts = subscription.get("trial_end")
    if trial_end_ts:
        user.trial_ends_at = datetime.utcfromtimestamp(trial_end_ts)
    else:
        user.trial_ends_at = None

    return user


def serialize_user_subscription(user):
    current_tier = get_effective_tier(user)
    return {
        "subscription_tier": user.subscription_tier,
        "effective_tier": current_tier,
        "subscription_status": user.subscription_status,
        "subscription_active": current_tier != "free",
        "stripe_customer_id": user.stripe_customer_id,
        "stripe_subscription_id": user.stripe_subscription_id,
        "trial_ends_at": user.trial_ends_at.isoformat() if user.trial_ends_at else None,
        "onboarding_completed": bool(user.onboarding_completed),
    }


@billing_bp.route("/admin/stripe-config", methods=["GET"])
@jwt_required()
def get_admin_stripe_config():
    user = get_current_user()
    if not is_admin_user(user):
        return jsonify({"message": "Admin access required"}), 403

    key_sources = {}
    config = {
        "secret_key": get_setting_value(STRIPE_SECRET_KEY_SETTING, env_fallback_key="STRIPE_SECRET_KEY"),
        "webhook_secret": get_setting_value(STRIPE_WEBHOOK_SECRET_SETTING, env_fallback_key="STRIPE_WEBHOOK_SECRET"),
        "price_plan_monthly": get_setting_value(STRIPE_PRICE_PLAN_SETTING, env_fallback_key="STRIPE_PRICE_PLAN_MONTHLY"),
        "price_thrive_monthly": get_setting_value(STRIPE_PRICE_THRIVE_SETTING, env_fallback_key="STRIPE_PRICE_THRIVE_MONTHLY"),
        "price_together_monthly": get_setting_value(STRIPE_PRICE_TOGETHER_SETTING, env_fallback_key="STRIPE_PRICE_TOGETHER_MONTHLY"),
        "trial_days_default": get_setting_value(STRIPE_TRIAL_DAYS_SETTING, env_fallback_key="STRIPE_TRIAL_DAYS_DEFAULT", default="0"),
        "frontend_base_url": frontend_base_url(),
    }

    for setting_key, env_key in [
        (STRIPE_SECRET_KEY_SETTING, "STRIPE_SECRET_KEY"),
        (STRIPE_WEBHOOK_SECRET_SETTING, "STRIPE_WEBHOOK_SECRET"),
        (STRIPE_PRICE_PLAN_SETTING, "STRIPE_PRICE_PLAN_MONTHLY"),
        (STRIPE_PRICE_THRIVE_SETTING, "STRIPE_PRICE_THRIVE_MONTHLY"),
        (STRIPE_PRICE_TOGETHER_SETTING, "STRIPE_PRICE_TOGETHER_MONTHLY"),
        (STRIPE_TRIAL_DAYS_SETTING, "STRIPE_TRIAL_DAYS_DEFAULT"),
        (STRIPE_FRONTEND_URL_SETTING, "FRONTEND_BASE_URL"),
    ]:
        key_sources[setting_key] = "database" if get_setting_row(setting_key) else ("env" if os.environ.get(env_key) else "unset")

    configured = all(
        [
            bool(config["secret_key"]),
            bool(config["webhook_secret"]),
            bool(config["price_plan_monthly"]),
            bool(config["price_thrive_monthly"]),
            bool(config["price_together_monthly"]),
        ]
    )

    return jsonify(
        {
            "configured": configured,
            "config": config,
            "sources": key_sources,
        }
    ), 200


@billing_bp.route("/admin/stripe-config", methods=["PUT"])
@jwt_required()
def update_admin_stripe_config():
    user = get_current_user()
    if not is_admin_user(user):
        return jsonify({"message": "Admin access required"}), 403

    data = request.get_json(silent=True) or {}

    mapping = {
        "secret_key": STRIPE_SECRET_KEY_SETTING,
        "webhook_secret": STRIPE_WEBHOOK_SECRET_SETTING,
        "price_plan_monthly": STRIPE_PRICE_PLAN_SETTING,
        "price_thrive_monthly": STRIPE_PRICE_THRIVE_SETTING,
        "price_together_monthly": STRIPE_PRICE_TOGETHER_SETTING,
        "trial_days_default": STRIPE_TRIAL_DAYS_SETTING,
        "frontend_base_url": STRIPE_FRONTEND_URL_SETTING,
    }

    updated_fields = []
    for payload_key, setting_key in mapping.items():
        if payload_key not in data:
            continue

        value = data.get(payload_key)
        if value is None:
            continue

        value = str(value).strip()

        if payload_key == "trial_days_default":
            try:
                parsed = int(value)
            except (TypeError, ValueError):
                return jsonify({"message": "trial_days_default must be an integer"}), 400
            if parsed < 0:
                return jsonify({"message": "trial_days_default cannot be negative"}), 400
            value = str(parsed)

        if payload_key == "secret_key" and value and not value.startswith("sk_"):
            return jsonify({"message": "Stripe secret key should start with sk_"}), 400

        if payload_key == "webhook_secret" and value and not value.startswith("whsec_"):
            return jsonify({"message": "Stripe webhook secret should start with whsec_"}), 400

        if payload_key.startswith("price_") and value and not value.startswith("price_"):
            return jsonify({"message": f"{payload_key} should start with price_"}), 400

        upsert_setting_value(setting_key, value)
        updated_fields.append(payload_key)

    if not updated_fields:
        return jsonify({"message": "No valid Stripe fields provided"}), 400

    db.session.commit()

    return jsonify(
        {
            "message": "Stripe configuration saved successfully",
            "updated_fields": updated_fields,
        }
    ), 200


@billing_bp.route("/admin/stripe-config/test", methods=["POST"])
@jwt_required()
def test_admin_stripe_config():
    user = get_current_user()
    if not is_admin_user(user):
        return jsonify({"message": "Admin access required"}), 403

    data = request.get_json(silent=True) or {}
    secret_key = (data.get("secret_key") or "").strip() or get_setting_value(
        STRIPE_SECRET_KEY_SETTING,
        env_fallback_key="STRIPE_SECRET_KEY",
    )

    if not secret_key:
        return jsonify({"message": "Stripe secret key is required for test"}), 400

    plan_price_ids = {
        "plan": (data.get("price_plan_monthly") or "").strip() or get_setting_value(STRIPE_PRICE_PLAN_SETTING, env_fallback_key="STRIPE_PRICE_PLAN_MONTHLY"),
        "thrive": (data.get("price_thrive_monthly") or "").strip() or get_setting_value(STRIPE_PRICE_THRIVE_SETTING, env_fallback_key="STRIPE_PRICE_THRIVE_MONTHLY"),
        "together": (data.get("price_together_monthly") or "").strip() or get_setting_value(STRIPE_PRICE_TOGETHER_SETTING, env_fallback_key="STRIPE_PRICE_TOGETHER_MONTHLY"),
    }

    stripe.api_key = secret_key

    try:
        account = stripe.Account.retrieve()
        price_checks = {}
        for plan_id, price_id in plan_price_ids.items():
            if not price_id:
                price_checks[plan_id] = {"ok": False, "message": "missing"}
                continue
            try:
                price = stripe.Price.retrieve(price_id)
                active = bool(price.get("active"))
                recurring = (price.get("recurring") or {}).get("interval")
                price_checks[plan_id] = {
                    "ok": active and recurring == "month",
                    "message": f"active={active}, interval={recurring or 'none'}",
                }
            except Exception as price_exc:
                price_checks[plan_id] = {"ok": False, "message": str(price_exc)}

        return jsonify(
            {
                "working": True,
                "message": "Stripe credentials are working",
                "account_id": account.get("id"),
                "account_email": account.get("email"),
                "price_checks": price_checks,
            }
        ), 200
    except Exception as exc:
        return jsonify(
            {
                "working": False,
                "message": "Stripe configuration test failed",
                "error": str(exc),
            }
        ), 400


@billing_bp.route("/plans", methods=["GET"])
def get_plans():
    plans = []
    for _, plan in PLAN_DEFINITIONS.items():
        price_id = get_setting_value(plan["price_setting_key"], env_fallback_key=plan["price_env_key"])
        plans.append(
            {
                "id": plan["id"],
                "name": plan["name"],
                "price_monthly": plan["price_monthly"],
                "description": plan["description"],
                "price_id_configured": bool(price_id),
            }
        )
    return jsonify({"plans": plans}), 200


@billing_bp.route("/subscription", methods=["GET"])
@jwt_required()
def get_current_subscription():
    user = User.query.get(get_user_id())
    if not user:
        return jsonify({"message": "User not found"}), 404

    sync_remote = request.args.get("sync", "false").lower() == "true"
    if sync_remote and user.stripe_subscription_id:
        try:
            stripe_client = get_stripe_client()
            subscription = stripe_client.Subscription.retrieve(
                user.stripe_subscription_id,
                expand=["items.data.price"],
            )
            sync_user_from_subscription(subscription, user=user)
            db.session.commit()
        except Exception as exc:
            return jsonify({"message": f"Unable to sync subscription: {exc}"}), 500

    return jsonify({"subscription": serialize_user_subscription(user)}), 200


@billing_bp.route("/checkout-session", methods=["POST"])
@jwt_required()
def create_checkout_session():
    user = User.query.get(get_user_id())
    if not user:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    requested_plan = normalize_tier(data.get("plan_id"))
    if requested_plan not in PLAN_DEFINITIONS:
        return jsonify({"message": "Invalid plan_id"}), 400

    if (user.subscription_status or "").lower() in ACTIVE_SUBSCRIPTION_STATUSES and user.stripe_subscription_id:
        return jsonify({"message": "Subscription already active. Use plan change instead."}), 409

    price_id = price_id_for_plan(requested_plan)
    if not price_id:
        return jsonify({"message": f"Missing Stripe price ID for {requested_plan} plan"}), 500

    trial_days = data.get("trial_days")
    if trial_days is None:
        configured_trial = get_setting_value(
            STRIPE_TRIAL_DAYS_SETTING,
            env_fallback_key="STRIPE_TRIAL_DAYS_DEFAULT",
            default="0",
        )
        trial_days = configured_trial
    try:
        trial_days = max(0, int(trial_days))
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid trial_days"}), 400

    success_url = (data.get("success_url") or f"{frontend_base_url()}/payment-success.html?session_id={{CHECKOUT_SESSION_ID}}").strip()
    cancel_url = (data.get("cancel_url") or f"{frontend_base_url()}/premium-plan.html?checkout=cancelled").strip()
    promotion_code = (data.get("promotion_code") or "").strip() or None

    try:
        stripe_client = get_stripe_client()

        if not user.stripe_customer_id:
            customer = stripe_client.Customer.create(
                email=user.email,
                name=" ".join(part for part in [user.first_name, user.last_name] if part).strip() or user.email,
                metadata={"user_id": str(user.id)},
            )
            user.stripe_customer_id = customer.get("id")
            db.session.commit()

        session_payload = {
            "mode": "subscription",
            "customer": user.stripe_customer_id,
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": str(user.id),
            "metadata": {"user_id": str(user.id), "plan_id": requested_plan},
            "subscription_data": {
                "metadata": {"user_id": str(user.id), "plan_id": requested_plan},
            },
            "allow_promotion_codes": promotion_code is None,
        }

        if trial_days > 0:
            session_payload["subscription_data"]["trial_period_days"] = trial_days

        if promotion_code:
            session_payload["discounts"] = [{"promotion_code": promotion_code}]

        checkout_session = stripe_client.checkout.Session.create(**session_payload)
        return jsonify({"checkout_url": checkout_session.url, "session_id": checkout_session.id}), 201
    except Exception as exc:
        return jsonify({"message": f"Stripe checkout error: {exc}"}), 500


@billing_bp.route("/portal-session", methods=["POST"])
@jwt_required()
def create_billing_portal_session():
    user = User.query.get(get_user_id())
    if not user:
        return jsonify({"message": "User not found"}), 404
    if not user.stripe_customer_id:
        return jsonify({"message": "No Stripe customer found for this user"}), 400

    data = request.get_json(silent=True) or {}
    return_url = (data.get("return_url") or f"{frontend_base_url()}/settings.html").strip()

    try:
        stripe_client = get_stripe_client()
        portal = stripe_client.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=return_url,
        )
        return jsonify({"url": portal.url}), 201
    except Exception as exc:
        return jsonify({"message": f"Unable to open billing portal: {exc}"}), 500


@billing_bp.route("/change-plan", methods=["POST"])
@jwt_required()
def change_subscription_plan():
    user = User.query.get(get_user_id())
    if not user:
        return jsonify({"message": "User not found"}), 404
    if not user.stripe_subscription_id:
        return jsonify({"message": "No active Stripe subscription found"}), 404

    data = request.get_json(silent=True) or {}
    requested_plan = normalize_tier(data.get("plan_id"))
    if requested_plan not in PLAN_DEFINITIONS:
        return jsonify({"message": "Invalid plan_id"}), 400

    price_id = price_id_for_plan(requested_plan)
    if not price_id:
        return jsonify({"message": f"Missing Stripe price ID for {requested_plan} plan"}), 500

    try:
        stripe_client = get_stripe_client()
        subscription = stripe_client.Subscription.retrieve(
            user.stripe_subscription_id,
            expand=["items.data.price"],
        )
        items = ((subscription.get("items") or {}).get("data") or [])
        if not items:
            return jsonify({"message": "Subscription items not found"}), 500

        updated = stripe_client.Subscription.modify(
            user.stripe_subscription_id,
            cancel_at_period_end=False,
            items=[{"id": items[0].get("id"), "price": price_id}],
            metadata={"user_id": str(user.id), "plan_id": requested_plan},
            proration_behavior="create_prorations",
        )

        sync_user_from_subscription(updated, user=user)
        db.session.commit()

        return jsonify(
            {
                "message": f"Subscription moved to {plan_name(requested_plan)}",
                "subscription": serialize_user_subscription(user),
            }
        ), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({"message": f"Unable to change plan: {exc}"}), 500


@billing_bp.route("/cancel", methods=["POST"])
@jwt_required()
def cancel_subscription():
    user = User.query.get(get_user_id())
    if not user:
        return jsonify({"message": "User not found"}), 404
    if not user.stripe_subscription_id:
        return jsonify({"message": "No active Stripe subscription found"}), 404

    data = request.get_json(silent=True) or {}
    cancel_now = bool(data.get("cancel_now", False))

    try:
        stripe_client = get_stripe_client()
        if cancel_now:
            stripe_client.Subscription.delete(user.stripe_subscription_id)
            user.subscription_status = "canceled"
            user.subscription_tier = "free"
            user.stripe_subscription_id = None
        else:
            stripe_client.Subscription.modify(user.stripe_subscription_id, cancel_at_period_end=True)
            user.subscription_status = "active"

        db.session.commit()
        return jsonify({"message": "Subscription cancellation request saved"}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({"message": f"Unable to cancel subscription: {exc}"}), 500


@billing_bp.route("/retry-payment", methods=["POST"])
@jwt_required()
def retry_failed_payment():
    user = User.query.get(get_user_id())
    if not user:
        return jsonify({"message": "User not found"}), 404
    if not user.stripe_customer_id:
        return jsonify({"message": "No Stripe customer found for this user"}), 400

    try:
        stripe_client = get_stripe_client()
        invoices = stripe_client.Invoice.list(customer=user.stripe_customer_id, status="open", limit=10)
        open_invoices = invoices.get("data") or []
        if not open_invoices:
            return jsonify({"message": "No open invoice found to retry"}), 404

        invoice = open_invoices[0]
        retried = stripe_client.Invoice.pay(invoice.get("id"))
        return jsonify(
            {
                "message": "Payment retry attempted",
                "invoice_id": retried.get("id"),
                "invoice_status": retried.get("status"),
            }
        ), 200
    except Exception as exc:
        return jsonify({"message": f"Unable to retry payment: {exc}"}), 500


@billing_bp.route("/sync", methods=["POST"])
@jwt_required()
def sync_subscription_state():
    user = User.query.get(get_user_id())
    if not user:
        return jsonify({"message": "User not found"}), 404

    if not user.stripe_subscription_id:
        user.subscription_tier = "free"
        user.subscription_status = "inactive"
        db.session.commit()
        return jsonify({"subscription": serialize_user_subscription(user)}), 200

    try:
        stripe_client = get_stripe_client()
        subscription = stripe_client.Subscription.retrieve(
            user.stripe_subscription_id,
            expand=["items.data.price"],
        )
        sync_user_from_subscription(subscription, user=user)
        db.session.commit()
        return jsonify({"subscription": serialize_user_subscription(user)}), 200
    except Exception as exc:
        return jsonify({"message": f"Unable to sync subscription: {exc}"}), 500


@billing_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    try:
        stripe_client = get_stripe_client()
    except RuntimeError as exc:
        return jsonify({"message": str(exc)}), 500

    payload = request.get_data(as_text=False)
    signature = request.headers.get("Stripe-Signature")
    webhook_secret = get_setting_value(
        STRIPE_WEBHOOK_SECRET_SETTING,
        env_fallback_key="STRIPE_WEBHOOK_SECRET",
    )

    try:
        if webhook_secret:
            event = stripe_client.Webhook.construct_event(payload, signature, webhook_secret)
        else:
            event = json.loads(payload.decode("utf-8"))
    except Exception as exc:
        return jsonify({"message": f"Invalid webhook payload: {exc}"}), 400

    event_type = event.get("type")
    event_data = (event.get("data") or {}).get("object") or {}

    try:
        if event_type == "checkout.session.completed":
            customer_id = event_data.get("customer")
            subscription_id = event_data.get("subscription")
            metadata = event_data.get("metadata") or {}
            user = resolve_user_by_customer_or_metadata(customer_id, metadata)
            if user and subscription_id:
                subscription = stripe_client.Subscription.retrieve(
                    subscription_id,
                    expand=["items.data.price"],
                )
                sync_user_from_subscription(subscription, user=user)
                db.session.commit()

        elif event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
            user = sync_user_from_subscription(event_data)
            if user:
                db.session.commit()

        elif event_type == "invoice.paid":
            customer_id = event_data.get("customer")
            metadata = event_data.get("metadata") or {}
            user = resolve_user_by_customer_or_metadata(customer_id, metadata)
            if user:
                subscription_id = event_data.get("subscription")
                if subscription_id:
                    subscription = stripe_client.Subscription.retrieve(
                        subscription_id,
                        expand=["items.data.price"],
                    )
                    sync_user_from_subscription(subscription, user=user)
                    db.session.commit()

                invoice_url = event_data.get("hosted_invoice_url") or event_data.get("invoice_pdf")
                send_invoice_receipt_email(user, invoice_url or "Stripe dashboard")
                send_payment_confirmation_email(
                    user,
                    plan_name(user.subscription_tier),
                    amount_to_text(event_data.get("amount_paid"), event_data.get("currency")),
                )

        elif event_type == "invoice.payment_failed":
            customer_id = event_data.get("customer")
            metadata = event_data.get("metadata") or {}
            user = resolve_user_by_customer_or_metadata(customer_id, metadata)
            if user:
                user.subscription_status = "past_due"
                db.session.commit()
                send_failed_payment_email(user)

    except Exception as exc:
        db.session.rollback()
        return jsonify({"message": f"Webhook processing error: {exc}"}), 500

    return jsonify({"received": True}), 200
