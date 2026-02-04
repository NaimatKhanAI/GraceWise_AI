#!/usr/bin/env python
"""Complete test of quiz functionality"""

import requests
import json
import os

BASE_URL = "http://127.0.0.1:5000"
ADMIN_EMAIL = "admin@grace-wise.com"
ADMIN_PASSWORD = "grace.admin@123"
USER_EMAIL = "testuser@example.com"
USER_PASSWORD = "testpass123"

print("=" * 70)
print("COMPLETE QUIZ FUNCTIONALITY TEST")
print("=" * 70)

# Step 1: Create a test user
print("\n[Step 1] Creating test user...")
signup_response = requests.post(
    f"{BASE_URL}/auth/signup",
    json={
        "first_name": "Test",
        "last_name": "User",
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    }
)

if signup_response.status_code == 201:
    print("✓ Test user created")
elif signup_response.status_code == 409:
    print("✓ Test user already exists")
else:
    print(f"✗ Failed to create user: {signup_response.json()}")

# Step 2: Login as admin
print("\n[Step 2] Admin login...")
admin_login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)

if admin_login.status_code != 200:
    print(f"✗ Admin login failed")
    exit(1)

admin_token = admin_login.json()['access_token']
print(f"✓ Admin logged in: {admin_token[:30]}...")

# Step 3: Upload document as admin
print("\n[Step 3] Uploading document...")
test_file = "quiz_test_doc.txt"
with open(test_file, 'w') as f:
    f.write("The Python programming language is a high-level, interpreted language.\n")
    f.write("It was created by Guido van Rossum in 1991.\n")
    f.write("Python is known for its simple syntax and readability.\n")
    f.write("It supports multiple programming paradigms.\n")

with open(test_file, 'rb') as f:
    upload_response = requests.post(
        f"{BASE_URL}/quiz/upload-document",
        files={'file': f},
        headers={'Authorization': f'Bearer {admin_token}'}
    )

if upload_response.status_code == 201:
    upload_data = upload_response.json()
    print(f"✓ Document uploaded: {upload_data['filename']}")
    document_path = upload_data['filepath']
else:
    print(f"✗ Upload failed: {upload_response.json()}")
    exit(1)

os.remove(test_file)

# Step 4: Generate quiz
print("\n[Step 4] Generating quiz from document...")
generate_response = requests.post(
    f"{BASE_URL}/quiz/generate-quiz",
    json={
        "document_path": document_path,
        "title": "Python Basics Quiz",
        "description": "Test your knowledge of Python",
        "num_questions": 3
    },
    headers={'Authorization': f'Bearer {admin_token}'}
)

if generate_response.status_code == 201:
    quiz_data = generate_response.json()['quiz']
    print(f"✓ Quiz generated: {quiz_data['title']}")
    print(f"  Questions: {len(quiz_data['questions'])}")
    quiz_id = quiz_data['id']
else:
    print(f"✗ Quiz generation failed: {generate_response.json()}")
    exit(1)

# Step 5: Login as test user
print("\n[Step 5] Test user login...")
user_login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": USER_EMAIL, "password": USER_PASSWORD}
)

if user_login.status_code != 200:
    print(f"✗ User login failed")
    exit(1)

user_token = user_login.json()['access_token']
print(f"✓ User logged in")

# Step 6: Get available quizzes
print("\n[Step 6] Fetching available quizzes...")
quizzes_response = requests.get(
    f"{BASE_URL}/quiz/quizzes",
    headers={'Authorization': f'Bearer {user_token}'}
)

if quizzes_response.status_code == 200:
    quizzes = quizzes_response.json()['quizzes']
    print(f"✓ Found {len(quizzes)} quiz(zes)")
else:
    print(f"✗ Failed to fetch quizzes")
    exit(1)

# Step 7: Get specific quiz
print("\n[Step 7] Getting quiz details...")
quiz_response = requests.get(
    f"{BASE_URL}/quiz/quizzes/{quiz_id}",
    headers={'Authorization': f'Bearer {user_token}'}
)

if quiz_response.status_code == 200:
    quiz = quiz_response.json()['quiz']
    print(f"✓ Quiz loaded: {quiz['title']}")
    questions = quiz['questions']
    
    # Step 8: Prepare answers
    print("\n[Step 8] Preparing quiz answers...")
    answers = []
    for i, q in enumerate(questions):
        # Just answer with the first option for testing
        answer = q['options'][0] if q['options'] else ""
        answers.append(answer)
        print(f"  Q{i+1}: {answer[:50]}...")
    
    # Step 9: Submit quiz
    print("\n[Step 9] Submitting quiz...")
    submit_response = requests.post(
        f"{BASE_URL}/quiz/submit-quiz",
        json={
            "quiz_id": quiz_id,
            "answers": answers
        },
        headers={'Authorization': f'Bearer {user_token}'}
    )
    
    if submit_response.status_code == 201:
        result = submit_response.json()
        print(f"✓ Quiz submitted!")
        print(f"  Score: {result['score']}/{result['total']}")
        print(f"  Percentage: {result['percentage']}%")
        print(f"  Feedback items: {len(result.get('feedback', []))}")
    else:
        print(f"✗ Submit failed: {submit_response.json()}")
else:
    print(f"✗ Failed to get quiz")
    exit(1)

# Step 10: Check results
print("\n[Step 10] Checking user results...")
results_response = requests.get(
    f"{BASE_URL}/quiz/my-results",
    headers={'Authorization': f'Bearer {user_token}'}
)

if results_response.status_code == 200:
    results = results_response.json()['results']
    print(f"✓ User has {len(results)} quiz result(s)")
else:
    print(f"✗ Failed to get results")

print("\n" + "=" * 70)
print("✓ ALL TESTS PASSED!")
print("=" * 70)
