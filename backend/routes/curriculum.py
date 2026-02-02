from flask import Blueprint, request, jsonify
from models import db, Curriculum, Devotional

curriculum_bp = Blueprint("curriculum", __name__)

#Create curriculum
@curriculum_bp.route("/", methods=["POST"])
def create_curriculum():
    data = request.json

    curriculum = Curriculum(
        title=data["title"],
        description=data["description"],
        age_group=data.get("age_group"),
        week=data.get("week"),
        devotional_id=data.get("devotional_id")
    )

    db.session.add(curriculum)
    db.session.commit()

    return jsonify({"message": "Curriculum created successfully"}), 201


#Get all curriculum
@curriculum_bp.route("/", methods=["GET"])
def get_all_curriculum():
    items = Curriculum.query.order_by(Curriculum.week).all()

    return jsonify([
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "age_group": c.age_group,
            "week": c.week,
            "devotional_id": c.devotional_id,
            "created_at": c.created_at.isoformat()
        }
        for c in items
    ])


#Get single curriculum
@curriculum_bp.route("/<int:id>", methods=["GET"])
def get_curriculum(id):
    c = Curriculum.query.get_or_404(id)

    return jsonify({
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "age_group": c.age_group,
        "week": c.week,
        "devotional_id": c.devotional_id,
        "created_at": c.created_at.isoformat()
    })
