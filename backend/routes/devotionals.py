from flask import Blueprint, request, jsonify
from models import db, Devotional, DevotionalProgress, User

devotionals_bp = Blueprint("devotionals", __name__)

#Get all devotionals
@devotionals_bp.route("/", methods=["GET"])
def get_devotionals():
    devotionals = Devotional.query.all()
    result = []
    for d in devotionals:
        result.append({
            "id": d.id,
            "title": d.title,
            "content": d.content,
            "date": d.date.isoformat() if d.date else None,
            "created_at": d.created_at.isoformat()
        })
    return jsonify(result)

#Add a new devotional
@devotionals_bp.route("/", methods=["POST"])
def add_devotional():
    data = request.json
    new_devotional = Devotional(
        title=data.get("title"),
        content=data.get("content"),
        date=data.get("date")
    )
    db.session.add(new_devotional)
    db.session.commit()
    return jsonify({"message": "Devotional added successfully", "id": new_devotional.id})

#Get single devotional by ID
@devotionals_bp.route("/<int:id>", methods=["GET"])
def get_devotional(id):
    d = Devotional.query.get_or_404(id)
    return jsonify({
        "id": d.id,
        "title": d.title,
        "content": d.content,
        "date": d.date.isoformat() if d.date else None,
        "created_at": d.created_at.isoformat()
    })

#Update devotional by ID
@devotionals_bp.route("/<int:id>", methods=["PUT"])
def update_devotional(id):
    d = Devotional.query.get_or_404(id)
    data = request.json
    d.title = data.get("title", d.title)
    d.content = data.get("content", d.content)
    d.date = data.get("date", d.date)
    db.session.commit()
    return jsonify({"message": "Devotional updated successfully"})

#Delete devotional by ID
@devotionals_bp.route("/<int:id>", methods=["DELETE"])
def delete_devotional(id):
    d = Devotional.query.get_or_404(id)
    db.session.delete(d)
    db.session.commit()
    return jsonify({"message": "Devotional deleted successfully"})

#Mark devotional as completed by a user
@devotionals_bp.route("/<int:id>/complete", methods=["POST"])
def complete_devotional(id):
    data = request.json
    user_id = data.get("user_id")
    # check if user exists
    user = User.query.get_or_404(user_id)

    # check if already completed
    existing = DevotionalProgress.query.filter_by(user_id=user_id, devotional_id=id).first()
    if existing:
        return jsonify({"message": "Devotional already completed"}), 400

    progress = DevotionalProgress(user_id=user_id, devotional_id=id)
    db.session.add(progress)
    db.session.commit()
    return jsonify({"message": "Devotional marked as completed"})
