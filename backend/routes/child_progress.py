from flask import Blueprint, jsonify
from models import db, Child, Devotional, DevotionalProgress

child_progress_bp = Blueprint("child_progress", __name__)

#Add a test child (for testing purposes)
@child_progress_bp.route("/add_child", methods=["POST"])
def add_child():
    child = Child(name="Test Child")
    db.session.add(child)
    db.session.commit()
    return jsonify({
        "message": "Child created",
        "child_id": child.id
    })

#Get child progress summary
@child_progress_bp.route("/<int:child_id>", methods=["GET"])
def get_child_progress(child_id):
    # Check if child exists
    child = Child.query.get_or_404(child_id)

    total_devotionals = Devotional.query.count()
    completed = DevotionalProgress.query.filter_by(child_id=child_id).count()
    remaining = total_devotionals - completed
    completion_percentage = (completed / total_devotionals * 100) if total_devotionals > 0 else 0

    # Optional: list of completed devotional IDs
    completed_devotional_ids = [
        dp.devotional_id for dp in DevotionalProgress.query.filter_by(child_id=child_id).all()
    ]

    return jsonify({
        "child_id": child.id,
        "total_devotionals": total_devotionals,
        "completed_devotionals": completed,
        "remaining_devotionals": remaining,
        "completion_percentage": completion_percentage,
        "completed_devotional_ids": completed_devotional_ids
    })


# ✅ Get detailed progress for each devotional
@child_progress_bp.route("/<int:child_id>/details", methods=["GET"])
def get_child_progress_details(child_id):
    child = Child.query.get_or_404(child_id)
    
    devotionals = Devotional.query.all()
    completed_ids = [dp.devotional_id for dp in DevotionalProgress.query.filter_by(child_id=child_id).all()]

    devotional_status = []
    for d in devotionals:
        devotional_status.append({
            "id": d.id,
            "title": d.title,
            "completed": d.id in completed_ids
        })

    total_devotionals = len(devotionals)
    completed_count = len(completed_ids)
    remaining = total_devotionals - completed_count
    completion_percentage = (completed_count / total_devotionals * 100) if total_devotionals > 0 else 0

    return jsonify({
        "child_id": child.id,
        "total_devotionals": total_devotionals,
        "completed_devotionals": completed_count,
        "remaining_devotionals": remaining,
        "completion_percentage": completion_percentage,
        "devotional_status": devotional_status
    })
