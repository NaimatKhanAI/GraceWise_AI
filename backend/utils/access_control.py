from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required


TIER_LEVELS = {
    "free": 0,
    "plan": 1,
    "thrive": 2,
    "together": 3,
}

ACTIVE_SUBSCRIPTION_STATUSES = {
    "active",
    "trialing",
    "past_due",
}


def normalize_tier(raw_tier):
    tier = (raw_tier or "free").strip().lower()
    return tier if tier in TIER_LEVELS else "free"


def tier_level(raw_tier):
    return TIER_LEVELS.get(normalize_tier(raw_tier), 0)


def has_active_subscription(user):
    if not user:
        return False
    return (user.subscription_status or "").strip().lower() in ACTIVE_SUBSCRIPTION_STATUSES


def get_effective_tier(user):
    if not user or not has_active_subscription(user):
        return "free"
    return normalize_tier(user.subscription_tier)


def user_has_tier(user, required_tier):
    return tier_level(get_effective_tier(user)) >= tier_level(required_tier)


def get_tool_access(user):
    effective_tier = get_effective_tier(user)
    level = tier_level(effective_tier)

    # Tier inheritance:
    # Thrive (Tier 2) includes Plan (Tier 1).
    # Together (Tier 3) includes Plan + Thrive.
    return {
        "effective_tier": effective_tier,
        "build_my_week": level >= tier_level("plan"),
        "meal_planner": level >= tier_level("plan"),
        "help_my_child": level >= tier_level("thrive"),
        "chat_with_gracewise": level >= tier_level("plan"),
        "coaching_community": level >= tier_level("together"),
    }


def get_current_user():
    from models import User

    user_id = get_jwt_identity()
    if isinstance(user_id, str):
        user_id = int(user_id)
    return User.query.get(user_id)


def tier_required(required_tier):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({"message": "User not found"}), 404

            if user.is_admin:
                return fn(*args, **kwargs)

            effective_tier = get_effective_tier(user)
            if tier_level(effective_tier) < tier_level(required_tier):
                return jsonify(
                    {
                        "message": f"{required_tier.title()} subscription required",
                        "required_tier": normalize_tier(required_tier),
                        "current_tier": effective_tier,
                    }
                ), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator
