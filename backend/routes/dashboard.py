from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import db, User, Child, DevotionalProgress, Planner
from datetime import datetime, timedelta

dashboard_bp = Blueprint("dashboard", __name__)

# add routes related to dashboard summaries here
@dashboard_bp.route("/summary", methods=["GET"])
@jwt_required()
def dashboard_summary():
    """Get dashboard statistics for admin"""
    total_users = User.query.count()
    
    # Get active users (users who logged in within last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users = User.query.filter(
        User.is_active == True,
        User.last_login >= thirty_days_ago
    ).count() if hasattr(User, 'last_login') else User.query.filter_by(is_active=True).count()
    
    # Calculate sleeping users (inactive users)
    sleeping_users = User.query.filter_by(is_active=False).count()
    
    # Additional stats
    total_children = Child.query.count()
    completed_devotionals = DevotionalProgress.query.count()
    active_planners = Planner.query.count()
    
    # Calculate growth percentage (mock calculation for now)
    # In real implementation, compare with previous month
    total_users_growth = 16  # Mock value
    active_users_growth = -1  # Mock value

    return jsonify({
        "total_users": total_users,
        "total_users_growth": total_users_growth,
        "active_users": active_users,
        "active_users_growth": active_users_growth,
        "sleeping_users": sleeping_users,
        "completed_devotionals": completed_devotionals,
        "active_planners": active_planners
    })
