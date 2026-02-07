from models import db
from datetime import datetime


class Planner(db.Model):
    __tablename__ = "planner"
    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey("child.id"), nullable=False)
    task_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    date = db.Column(db.String(50), nullable=True)
    start_time = db.Column(db.String(10), nullable=True)  # HH:MM format
    end_time = db.Column(db.String(10), nullable=True)  # HH:MM format
    subject = db.Column(db.String(100), nullable=True)  # Subject or activity type
    subtitle = db.Column(db.String(150), nullable=True)  # Tutor name, quiz name, etc.
    status = db.Column(db.String(50), default="Pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
