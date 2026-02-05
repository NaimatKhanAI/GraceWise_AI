from datetime import datetime
from models import db


class Curriculum(db.Model):
    __tablename__ = "curriculum"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    age_group = db.Column(db.String(50))
    week = db.Column(db.Integer)
    devotional_id = db.Column(db.Integer, db.ForeignKey("devotional.id"), nullable=True)
    folder_name = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    modules = db.relationship("Module", back_populates="curriculum", cascade="all, delete-orphan")

    def to_dict(self, include_modules=False):
        result = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "age_group": self.age_group,
            "week": self.week,
            "devotional_id": self.devotional_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "module_count": len(self.modules) if self.modules else 0
        }
        if include_modules and self.modules:
            result["modules"] = [m.to_dict() for m in self.modules]
        return result
