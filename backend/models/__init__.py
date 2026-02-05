from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import all models
from models.user import User
from models.child import Child
from models.devotional import Devotional
from models.devotional_progress import DevotionalProgress
from models.planner import Planner
from models.curriculum import Curriculum
from models.quiz import Quiz
from models.quiz_result import QuizResult
from models.notification import Notification
from models.ai_session import AiSession

__all__ = ['db', 'User', 'Child', 'Devotional', 'DevotionalProgress', 'Planner', 'Curriculum', 'Quiz', 'QuizResult', 'Notification', 'AiSession']
