#!/usr/bin/env python
"""Simulate what happens when quiz.html page loads"""

import requests

BASE_URL = "http://127.0.0.1:5000"
USER_EMAIL = "testuser@example.com"
USER_PASSWORD = "testpass123"

print("=" * 70)
print("SIMULATING QUIZ.HTML PAGE LOAD")
print("=" * 70)

# Step 1: User login (what happens when page loads)
print("\n[1] Checking user authentication...")
user_login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": USER_EMAIL, "password": USER_PASSWORD}
)

if user_login.status_code == 200:
    token = user_login.json()['access_token']
    user_data = user_login.json()
    print(f"✓ User authenticated: {user_data.get('user', {}).get('first_name', 'Unknown')}")
else:
    print("✗ Authentication failed")
    exit(1)

# Step 2: Load quizzes (what loadQuizzes() does)
print("\n[2] Loading quizzes...")
response = requests.get(
    f"{BASE_URL}/quiz/quizzes",
    headers={'Authorization': f'Bearer {token}'}
)

print(f"Response status: {response.status_code}")

if response.ok:
    data = response.json()
    quizzes = data.get('quizzes', [])
    print(f"✓ Quizzes loaded successfully")
    print(f"  Total quizzes: {len(quizzes)}")
    
    if len(quizzes) > 0:
        print("\n[3] Quiz grid will display:")
        for i, quiz in enumerate(quizzes, 1):
            print(f"  • {quiz['title']} ({len(quiz['questions'])} questions)")
    else:
        print("\n[3] Empty state will show: 'No Quizzes Available'")
else:
    print(f"✗ Failed to load quizzes: {response.json()}")

print("\n" + "=" * 70)
print("✓ QUIZ PAGE LOAD SIMULATION COMPLETE")
print("=" * 70)
print("\nExpected behavior in browser:")
print("  1. Page loads")
print("  2. Auth check completes")
print("  3. User name displayed in header")
print("  4. Quiz grid populated with quiz cards")
print("  5. Users can click 'Take Quiz' on any card")
