#!/usr/bin/env python
"""Verify database schema"""

from app import app, db
from models import Quiz, QuizResult

with app.app_context():
    # Check tables exist
    inspector = db.inspect(db.engine)
    tables = inspector.get_table_names()
    
    print("=" * 60)
    print("DATABASE SCHEMA VERIFICATION")
    print("=" * 60)
    
    print("\nTables in database:")
    for table in sorted(tables):
        print(f"  ✓ {table}")
    
    # Check quiz table
    if 'quiz' in tables:
        print("\n[Quiz Table]")
        quiz_columns = inspector.get_columns('quiz')
        for col in quiz_columns:
            print(f"  - {col['name']}: {col['type']}")
    
    # Check quiz_result table
    if 'quiz_result' in tables:
        print("\n[Quiz Result Table]")
        result_columns = inspector.get_columns('quiz_result')
        for col in result_columns:
            print(f"  - {col['name']}: {col['type']}")
    
    # Count records
    quiz_count = Quiz.query.count()
    result_count = QuizResult.query.count()
    
    print(f"\n[Data]")
    print(f"  Quizzes: {quiz_count}")
    print(f"  Quiz Results: {result_count}")
    
    print("\n" + "=" * 60)
