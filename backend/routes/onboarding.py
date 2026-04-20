from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from models import db, OnboardingProfile, User
from utils.access_control import get_effective_tier, get_tool_access
from routes.billing import PLAN_DEFINITIONS


onboarding_bp = Blueprint("onboarding", __name__)

CORE_FIELDS = [
    "number_of_children",
    "ages_grades",
    "state",
    "homeschool_type",
    "work_schedule",
    "budget_level",
    "support_help",
    "main_goals",
]

PLAN_FIELDS = [
    "meal_planning_help",
    "morning_routine_help",
    "allergies_or_picky_eaters",
    "need_schedules",
    "need_checklists",
]

THRIVE_FIELDS = [
    "reading_struggles",
    "focus_adhd",
    "anxiety",
    "autism_sensory",
    "curriculum_problems",
    "records_help",
]

TOGETHER_FIELDS = [
    "accountability_help",
    "coaching_support",
    "transcript_help",
    "high_school_planning",
    "community_interest",
]

FIELD_LABELS = {
    "number_of_children": "Number of children",
    "ages_grades": "Ages / grades",
    "state": "State",
    "homeschool_type": "Homeschool type",
    "work_schedule": "Work schedule",
    "budget_level": "Budget level",
    "support_help": "Support help",
    "main_goals": "Main goals",
    "meal_planning_help": "Meal planning help",
    "morning_routine_help": "Morning routine help",
    "allergies_or_picky_eaters": "Allergies / picky eaters",
    "need_schedules": "Need schedules",
    "need_checklists": "Need checklists",
    "reading_struggles": "Reading struggles",
    "focus_adhd": "Focus / ADHD",
    "anxiety": "Anxiety",
    "autism_sensory": "Autism / sensory",
    "curriculum_problems": "Curriculum problems",
    "records_help": "Records help",
    "accountability_help": "Accountability help",
    "coaching_support": "Coaching support",
    "transcript_help": "Transcript help",
    "high_school_planning": "High school planning",
    "community_interest": "Community interest",
}


def get_user_from_id(user_id):
    if isinstance(user_id, str):
        user_id = int(user_id)
    return User.query.get(user_id)


def user_from_jwt():
    from flask_jwt_extended import get_jwt_identity

    return get_user_from_id(get_jwt_identity())


def allowed_tier_fields(tier):
    tier = (tier or "free").lower()
    fields = list(CORE_FIELDS)
    if tier in ("plan", "thrive", "together"):
        fields.extend(PLAN_FIELDS)
    if tier in ("thrive", "together"):
        fields.extend(THRIVE_FIELDS)
    if tier == "together":
        fields.extend(TOGETHER_FIELDS)
    return fields


def question_payload(fields):
    return [{"key": field, "label": FIELD_LABELS.get(field, field)} for field in fields]


@onboarding_bp.route("/questions", methods=["GET"])
@jwt_required()
def get_onboarding_questions():
    user = user_from_jwt()
    if not user:
        return jsonify({"message": "User not found"}), 404

    effective_tier = get_effective_tier(user)
    if effective_tier == "free":
        return jsonify({"message": "Active subscription required before onboarding"}), 403

    available_fields = allowed_tier_fields(effective_tier)

    return jsonify(
        {
            "tier": effective_tier,
            "plan_name": PLAN_DEFINITIONS.get(effective_tier, {}).get("name", effective_tier.title()),
            "core_questions": question_payload(CORE_FIELDS),
            "tier_questions": question_payload([f for f in available_fields if f not in CORE_FIELDS]),
            "all_questions": question_payload(available_fields),
        }
    ), 200


@onboarding_bp.route("/me", methods=["GET"])
@jwt_required()
def get_onboarding_profile():
    user = user_from_jwt()
    if not user:
        return jsonify({"message": "User not found"}), 404

    profile = OnboardingProfile.query.filter_by(user_id=user.id).first()
    effective_tier = get_effective_tier(user)
    available_fields = allowed_tier_fields(effective_tier)

    return jsonify(
        {
            "tier": effective_tier,
            "onboarding_completed": bool(user.onboarding_completed),
            "tool_access": get_tool_access(user),
            "allowed_fields": available_fields,
            "profile": profile.to_dict() if profile else None,
        }
    ), 200


@onboarding_bp.route("/me", methods=["POST"])
@jwt_required()
def save_onboarding_profile():
    user = user_from_jwt()
    if not user:
        return jsonify({"message": "User not found"}), 404

    effective_tier = get_effective_tier(user)
    if effective_tier == "free":
        return jsonify({"message": "Active subscription required before onboarding"}), 403

    data = request.get_json(silent=True) or {}
    allowed_fields = allowed_tier_fields(effective_tier)

    missing = [
        field
        for field in CORE_FIELDS
        if data.get(field) in (None, "", [])
    ]
    if missing:
        return jsonify({"message": "Missing core onboarding fields", "missing_fields": missing}), 400

    profile = OnboardingProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        profile = OnboardingProfile(user_id=user.id)
        db.session.add(profile)

    for field in allowed_fields:
        if field not in data:
            continue
        value = data.get(field)
        if field == "number_of_children" and value not in (None, ""):
            try:
                value = int(value)
            except (TypeError, ValueError):
                return jsonify({"message": "number_of_children must be an integer"}), 400
        setattr(profile, field, value)

    profile.completed_at = datetime.utcnow()
    user.onboarding_completed = True

    db.session.commit()

    return jsonify(
        {
            "message": "Onboarding saved successfully",
            "onboarding_completed": True,
            "tier": effective_tier,
            "profile": profile.to_dict(),
        }
    ), 200
