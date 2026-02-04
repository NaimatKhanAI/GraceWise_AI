#!/usr/bin/env python
"""Debug quiz visibility for regular users"""

import requests
import json

BASE_URL = "http://127.0.0.1:5000"
USER_EMAIL = "testuser@example.com"
USER_PASSWORD = "testpass123"

print("=" * 70)
print("DEBUG: User Quiz Visibility")
print("=" * 70)

# User login
print("\n[Step 1] User login...")
user_login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": USER_EMAIL, "password": USER_PASSWORD}
)

if user_login.status_code != 200:
    print(f"✗ User login failed: {user_login.json()}")
    exit(1)

user_token = user_login.json()['access_token']
print(f"✓ User logged in")

# Get quizzes
print("\n[Step 2] Fetching quizzes as user...")
response = requests.get(
    f"{BASE_URL}/quiz/quizzes",
    headers={'Authorization': f'Bearer {user_token}'}
)

print(f"Status: {response.status_code}")
data = response.json()

if response.ok:
    quizzes = data.get('quizzes', [])
    print(f"✓ Found {len(quizzes)} quiz(zes)")
    
    if len(quizzes) > 0:
        print("\nQuizzes:")
        for i, quiz in enumerate(quizzes, 1):
            print(f"\n  Quiz {i}:")
            print(f"    ID: {quiz['id']}")
            print(f"    Title: {quiz['title']}")
            print(f"    Description: {quiz.get('description', 'N/A')}")
            print(f"    Questions: {len(quiz.get('questions', []))}")
            print(f"    Is Active: {quiz.get('is_active', True)}")
            print(f"    Document: {quiz.get('document_name', 'N/A')}")
    else:
        print("\n✗ No quizzes found!")
        print("   Possible reasons:")
        print("   - No quizzes have been created by admin")
        print("   - Quizzes exist but are marked as inactive")
else:
    print(f"✗ Error: {data}")

print("\n" + "=" * 70)
