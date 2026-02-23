from datetime import datetime
from models import db


class AppSetting(db.Model):
    __tablename__ = "app_setting"

    id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(120), unique=True, nullable=False, index=True)
    setting_value = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "setting_key": self.setting_key,
            "setting_value": self.setting_value,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
