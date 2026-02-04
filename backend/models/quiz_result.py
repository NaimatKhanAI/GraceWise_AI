from datetime import datetime
from models import db


class QuizResult(db.Model):
    __tablename__ = "quiz_result"
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey("quiz.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    answers = db.Column(db.JSON, nullable=False)  # Store user answers as JSON
    score = db.Column(db.Float, nullable=False)
    total_questions = db.Column(db.Integer, nullable=False)
    feedback = db.Column(db.JSON, nullable=True)  # Store LLM feedback as JSON
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'user_id': self.user_id,
            'answers': self.answers,
            'score': self.score,
            'total_questions': self.total_questions,
            'feedback': self.feedback,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
