from datetime import datetime

from models import db


class OnboardingProfile(db.Model):
    __tablename__ = "onboarding_profile"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, unique=True, index=True)

    # Core questions
    number_of_children = db.Column(db.Integer, nullable=True)
    ages_grades = db.Column(db.Text, nullable=True)
    state = db.Column(db.String(120), nullable=True)
    homeschool_type = db.Column(db.String(120), nullable=True)
    work_schedule = db.Column(db.String(120), nullable=True)
    budget_level = db.Column(db.String(120), nullable=True)
    support_help = db.Column(db.Text, nullable=True)
    main_goals = db.Column(db.Text, nullable=True)

    # Plan tier extras
    meal_planning_help = db.Column(db.String(255), nullable=True)
    morning_routine_help = db.Column(db.String(255), nullable=True)
    allergies_or_picky_eaters = db.Column(db.Text, nullable=True)
    need_schedules = db.Column(db.String(255), nullable=True)
    need_checklists = db.Column(db.String(255), nullable=True)

    # Thrive tier extras
    reading_struggles = db.Column(db.Text, nullable=True)
    focus_adhd = db.Column(db.Text, nullable=True)
    anxiety = db.Column(db.Text, nullable=True)
    autism_sensory = db.Column(db.Text, nullable=True)
    curriculum_problems = db.Column(db.Text, nullable=True)
    records_help = db.Column(db.Text, nullable=True)

    # Together tier extras
    accountability_help = db.Column(db.Text, nullable=True)
    coaching_support = db.Column(db.Text, nullable=True)
    transcript_help = db.Column(db.Text, nullable=True)
    high_school_planning = db.Column(db.Text, nullable=True)
    community_interest = db.Column(db.Text, nullable=True)

    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "number_of_children": self.number_of_children,
            "ages_grades": self.ages_grades,
            "state": self.state,
            "homeschool_type": self.homeschool_type,
            "work_schedule": self.work_schedule,
            "budget_level": self.budget_level,
            "support_help": self.support_help,
            "main_goals": self.main_goals,
            "meal_planning_help": self.meal_planning_help,
            "morning_routine_help": self.morning_routine_help,
            "allergies_or_picky_eaters": self.allergies_or_picky_eaters,
            "need_schedules": self.need_schedules,
            "need_checklists": self.need_checklists,
            "reading_struggles": self.reading_struggles,
            "focus_adhd": self.focus_adhd,
            "anxiety": self.anxiety,
            "autism_sensory": self.autism_sensory,
            "curriculum_problems": self.curriculum_problems,
            "records_help": self.records_help,
            "accountability_help": self.accountability_help,
            "coaching_support": self.coaching_support,
            "transcript_help": self.transcript_help,
            "high_school_planning": self.high_school_planning,
            "community_interest": self.community_interest,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
