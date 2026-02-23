from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Child, DevotionalProgress, Planner, Quiz, QuizResult, Notification, AiSession
from datetime import datetime, timedelta
from sqlalchemy import func, and_

dashboard_bp = Blueprint("dashboard", __name__)

def get_user_id():
    """Get user_id from JWT token and convert to int"""
    user_id = get_jwt_identity()
    if isinstance(user_id, str):
        user_id = int(user_id)
    return user_id

# add routes related to dashboard summaries here
@dashboard_bp.route("/summary", methods=["GET"])
@jwt_required()
def dashboard_summary():
    """Get dashboard statistics for admin"""
    # Get current admin's details
    user_id = get_user_id()
    current_user = User.query.get(user_id)

    if not current_user or not current_user.is_admin:
        return jsonify({"message": "Admin access required"}), 403

    admin_name = current_user.first_name if current_user else "Admin"
    
    total_users = User.query.count()
    
    # Get active users (logged in within last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users = User.query.filter(
        User.is_active == True,
        User.last_login != None,
        User.last_login >= thirty_days_ago
    ).count()
    
    # Sleeping users = registered & active but haven't logged in within 30 days
    sleeping_users = total_users - active_users
    
    # Additional stats
    total_children = Child.query.count()
    completed_devotionals = DevotionalProgress.query.count()
    active_planners = Planner.query.count()
    
    # Calculate real growth percentages by comparing with previous month
    sixty_days_ago = datetime.utcnow() - timedelta(days=60)
    
    # Users created this month vs last month
    users_this_month = User.query.filter(User.created_at >= thirty_days_ago).count()
    users_last_month = User.query.filter(
        User.created_at >= sixty_days_ago,
        User.created_at < thirty_days_ago
    ).count()
    total_users_growth = round(((users_this_month - users_last_month) / max(users_last_month, 1)) * 100)
    
    # Active users this month vs last month
    active_last_month = User.query.filter(
        User.is_active == True,
        User.last_login != None,
        User.last_login >= sixty_days_ago,
        User.last_login < thirty_days_ago
    ).count()
    active_users_growth = round(((active_users - active_last_month) / max(active_last_month, 1)) * 100)

    return jsonify({
        "admin_name": admin_name,
        "total_users": total_users,
        "total_users_growth": total_users_growth,
        "active_users": active_users,
        "active_users_growth": active_users_growth,
        "sleeping_users": sleeping_users,
        "completed_devotionals": completed_devotionals,
        "active_planners": active_planners
    })


# ==================== STUDENT DASHBOARD ====================
@dashboard_bp.route("/student/stats", methods=["GET"])
@jwt_required()
def student_dashboard_stats():
    """Get student dashboard statistics"""
    try:
        user_id = get_user_id()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        # Total Quiz Attempts
        total_quiz_attempts = QuizResult.query.filter_by(user_id=user_id).count()
        
        # Average Score from Quizzes
        quiz_results = QuizResult.query.filter_by(user_id=user_id).all()
        average_score = 0
        if quiz_results:
            total_score = sum(result.score for result in quiz_results)
            average_score = round(total_score / len(quiz_results), 2)
        
        # Total Hours Spent (estimated: 0.5 hours per quiz + 1 hour per AI chat session)
        # Assuming average quiz duration is 30 min and AI chat average is 1 hour
        quiz_hours = total_quiz_attempts * 0.5
        ai_chat_hours = 0  # This would come from a chat session tracking if available
        total_hours_spent = round(quiz_hours + ai_chat_hours, 2)
        
        # Ranking among all students
        # Calculate average score for each user and rank them
        user_scores = db.session.query(
            QuizResult.user_id,
            func.avg(QuizResult.score).label('avg_score')
        ).group_by(QuizResult.user_id).all()
        
        user_rankings = sorted(user_scores, key=lambda x: x[1], reverse=True)
        ranking = 1
        for idx, (uid, score) in enumerate(user_rankings):
            if uid == user_id:
                ranking = idx + 1
                break
        
        total_students_ranked = len(user_rankings)
        
        return jsonify({
            "total_quiz_attempts": total_quiz_attempts,
            "average_score": average_score,
            "total_hours_spent": total_hours_spent,
            "ranking": ranking,
            "total_students_ranked": total_students_ranked
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error fetching student stats: {str(e)}"}), 500


@dashboard_bp.route("/student/notifications", methods=["GET"])
@jwt_required()
def student_notifications():
    """Get notifications for current student"""
    try:
        user_id = get_user_id()
        
        # Get latest 10 notifications
        notifications = Notification.query.filter_by(user_id=user_id).order_by(
            Notification.created_at.desc()
        ).limit(10).all()
        
        return jsonify({
            "notifications": [notif.to_dict() for notif in notifications],
            "unread_count": Notification.query.filter_by(user_id=user_id, is_read=False).count()
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error fetching notifications: {str(e)}"}), 500


@dashboard_bp.route("/student/notifications/<int:notification_id>/mark-read", methods=["PUT"])
@jwt_required()
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    try:
        user_id = get_user_id()
        notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
        
        if not notification:
            return jsonify({"message": "Notification not found"}), 404
        
        notification.is_read = True
        db.session.commit()
        
        return jsonify({"message": "Notification marked as read"}), 200
        
    except Exception as e:
        return jsonify({"message": f"Error marking notification: {str(e)}"}), 500


@dashboard_bp.route("/student/notifications/mark-all-read", methods=["PUT"])
@jwt_required()
def mark_all_notifications_read():
    """Mark all notifications as read for the current user"""
    try:
        user_id = get_user_id()
        
        # Update all unread notifications for this user
        Notification.query.filter_by(user_id=user_id, is_read=False).update({"is_read": True})
        db.session.commit()
        
        return jsonify({"message": "All notifications marked as read"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error marking all notifications: {str(e)}"}), 500


# ==================== STUDENT PROGRESS ====================
@dashboard_bp.route("/student/progress", methods=["GET"])
@jwt_required()
def student_progress_summary():
    """Get dynamic progress data for the student progress page"""
    try:
        user_id = get_user_id()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"message": "User not found"}), 404

        quiz_attempts = QuizResult.query.filter_by(user_id=user_id).count()
        quiz_results = QuizResult.query.filter_by(user_id=user_id).order_by(QuizResult.completed_at.desc()).all()

        average_score = 0
        best_score = 0
        if quiz_results:
            total_score = sum(result.score for result in quiz_results)
            average_score = round(total_score / len(quiz_results), 2)
            best_score = round(max(result.score for result in quiz_results), 2)

        ai_sessions = AiSession.query.filter_by(user_id=user_id).all()
        ai_minutes = sum(session.duration_minutes for session in ai_sessions)
        ai_hours = round(ai_minutes / 60, 2) if ai_minutes else 0

        quiz_hours = quiz_attempts * 0.5
        total_study_hours = round(quiz_hours + ai_hours, 2)

        subject_performance = db.session.query(
            Quiz.title.label('subject'),
            func.avg(QuizResult.score).label('avg_score')
        ).join(Quiz, Quiz.id == QuizResult.quiz_id).filter(
            QuizResult.user_id == user_id
        ).group_by(Quiz.title).order_by(func.avg(QuizResult.score).desc()).limit(6).all()

        subject_data = [
            {
                "subject": subject,
                "average_score": round(avg_score, 2) if avg_score is not None else 0
            }
            for subject, avg_score in subject_performance
        ]

        recent_activities = db.session.query(
            Quiz.title,
            QuizResult.score,
            QuizResult.completed_at
        ).join(Quiz, Quiz.id == QuizResult.quiz_id).filter(
            QuizResult.user_id == user_id
        ).order_by(QuizResult.completed_at.desc()).limit(6).all()

        activity_data = [
            {
                "title": title,
                "score": round(score, 2) if score is not None else 0,
                "completed_at": completed_at.isoformat() if completed_at else None
            }
            for title, score, completed_at in recent_activities
        ]

        return jsonify({
            "quiz_attempts": quiz_attempts,
            "average_score": average_score,
            "best_score": best_score,
            "study_hours": total_study_hours,
            "ai_session_count": len(ai_sessions),
            "subject_performance": subject_data,
            "recent_activities": activity_data
        }), 200

    except Exception as e:
        return jsonify({"message": f"Error fetching progress: {str(e)}"}), 500


# ==================== AI SESSION TRACKING ====================
@dashboard_bp.route("/student/ai-sessions/start", methods=["POST"])
@jwt_required()
def start_ai_session():
    """Start an AI assistant session for time tracking"""
    try:
        user_id = get_user_id()
        session = AiSession(user_id=user_id)
        db.session.add(session)
        db.session.commit()
        return jsonify({"session_id": session.id, "started_at": session.started_at.isoformat()}), 201
    except Exception as e:
        return jsonify({"message": f"Error starting AI session: {str(e)}"}), 500


@dashboard_bp.route("/student/ai-sessions/<int:session_id>/end", methods=["POST"])
@jwt_required()
def end_ai_session(session_id):
    """End an AI assistant session and compute duration"""
    try:
        user_id = get_user_id()
        session = AiSession.query.filter_by(id=session_id, user_id=user_id).first()
        if not session:
            return jsonify({"message": "Session not found"}), 404

        session.ended_at = datetime.utcnow()
        duration = session.ended_at - session.started_at
        session.duration_minutes = max(int(duration.total_seconds() / 60), 1)
        db.session.commit()

        return jsonify({
            "session_id": session.id,
            "duration_minutes": session.duration_minutes,
            "ended_at": session.ended_at.isoformat()
        }), 200
    except Exception as e:
        return jsonify({"message": f"Error ending AI session: {str(e)}"}), 500
