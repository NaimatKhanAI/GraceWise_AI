from datetime import datetime
from models import db


class Devotional(db.Model):
    __tablename__ = "devotional"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship with DevotionalProgress
    progress = db.relationship("DevotionalProgress", backref="devotional", cascade="all, delete-orphan")
