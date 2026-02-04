from models import db


class Child(db.Model):
    __tablename__ = "child"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=True)
