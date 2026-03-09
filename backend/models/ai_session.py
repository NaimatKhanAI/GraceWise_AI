from datetime import datetime
from models import db


class AiSession(db.Model):
    __tablename__ = "ai_session"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    chat_type = db.Column(db.String(20), default="general", nullable=False)  # general | lesson
    title = db.Column(db.String(255), nullable=True)
    lesson_id = db.Column(db.Integer, nullable=True)
    lesson_name = db.Column(db.String(255), nullable=True)
    lesson_desc = db.Column(db.Text, nullable=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    duration_minutes = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'chat_type': self.chat_type,
            'title': self.title,
            'lesson_id': self.lesson_id,
            'lesson_name': self.lesson_name,
            'lesson_desc': self.lesson_desc,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'duration_minutes': self.duration_minutes
        }
