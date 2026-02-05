from datetime import datetime
from models import db


class Lesson(db.Model):
    __tablename__ = "lesson"
    id = db.Column(db.Integer, primary_key=True)
    module_id = db.Column(db.Integer, db.ForeignKey("module.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    file_path = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(10), nullable=False)  # pdf, txt
    file_size = db.Column(db.Integer)  # in bytes
    order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    module = db.relationship("Module", back_populates="lessons")

    def to_dict(self):
        return {
            "id": self.id,
            "module_id": self.module_id,
            "name": self.name,
            "description": self.description,
            "file_path": self.file_path,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "order": self.order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
