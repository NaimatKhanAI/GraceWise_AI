from flask import Blueprint, jsonify
from models import db, User, Child, DevotionalProgress, Planner

dashboard_bp = Blueprint("dashboard", __name__)

# add routes related to dashboard summaries here
@dashboard_bp.route("/summary", methods=["GET"])
def dashboard_summary():
    total_users = User.query.count()
    total_children = Child.query.count()
    completed_devotionals = DevotionalProgress.query.count()
    active_planners = Planner.query.count()

    return jsonify({
        "total_users": total_users,
        "total_children": total_children,
        "completed_devotionals": completed_devotionals,
        "active_planners": active_planners
    })
