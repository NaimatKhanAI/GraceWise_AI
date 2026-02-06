from datetime import datetime
from models import db


class Module(db.Model):
    __tablename__ = "module"
    id = db.Column(db.Integer, primary_key=True)
    curriculum_id = db.Column(db.Integer, db.ForeignKey("curriculum.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    folder_name = db.Column(db.String(200))
    order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    curriculum = db.relationship("Curriculum", back_populates="modules")
    lessons = db.relationship("Lesson", back_populates="module", cascade="all, delete-orphan")

    def to_dict(self, include_lessons=False):
        result = {
            "id": self.id,
            "curriculum_id": self.curriculum_id,
            "name": self.name,
            "description": self.description,
            "order": self.order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "lesson_count": len(self.lessons) if self.lessons else 0
        }
        if include_lessons:
            result["lessons"] = [lesson.to_dict() for lesson in self.lessons]
        return result
