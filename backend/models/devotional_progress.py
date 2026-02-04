from models import db


class DevotionalProgress(db.Model):
    __tablename__ = "devotional_progress"

    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(
        db.Integer,
        db.ForeignKey("child.id"),
        nullable=False
    )
    devotional_id = db.Column(
        db.Integer,
        db.ForeignKey("devotional.id"),
        nullable=False
    )
