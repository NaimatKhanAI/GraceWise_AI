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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
