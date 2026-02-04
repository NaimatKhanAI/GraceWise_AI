#!/usr/bin/env python
"""Test complete flow: upload, list, generate, submit"""

import requests
import json
import os

BASE_URL = "http://127.0.0.1:5000"
ADMIN_EMAIL = "admin@grace-wise.com"
ADMIN_PASSWORD = "grace.admin@123"
USER_EMAIL = "testuser2@example.com"
USER_PASSWORD = "testpass123"

print("=" * 70)
print("COMPLETE WORKFLOW TEST WITH DOCUMENT LISTING")
print("=" * 70)

# Step 1: Create test user
print("\n[Step 1] Creating test user...")
signup_response = requests.post(
    f"{BASE_URL}/auth/signup",
    json={
        "first_name": "Test",
        "last_name": "User2",
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    }
)

if signup_response.status_code in [201, 409]:
    print("✓ Test user ready")
else:
    print(f"✗ Failed to create user")

# Step 2: Admin login
print("\n[Step 2] Admin login...")
admin_login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)

admin_token = admin_login.json()['access_token']
print(f"✓ Admin logged in")

# Step 3: List uploaded documents
print("\n[Step 3] Listing uploaded documents...")
docs_response = requests.get(
    f"{BASE_URL}/quiz/uploaded-documents",
    headers={'Authorization': f'Bearer {admin_token}'}
)

if docs_response.ok:
    documents = docs_response.json()['documents']
    print(f"✓ Found {len(documents)} documents")
    
    if len(documents) > 0:
        # Prefer text files over PDFs
        text_docs = [d for d in documents if d['filename'].endswith('.txt')]
        if text_docs:
            selected_doc = text_docs[0]
        else:
            selected_doc = documents[0]
        print(f"  Using: {selected_doc['filename']}")
    else:
        print("✗ No documents available. Uploading test document...")
        test_file = "test_workflow.txt"
        with open(test_file, 'w') as f:
            f.write("Machine learning is a subset of artificial intelligence.\n")
            f.write("It enables computers to learn from data without being explicitly programmed.\n")
            f.write("Common ML algorithms include linear regression, decision trees, and neural networks.\n")
        
        with open(test_file, 'rb') as f:
            upload_response = requests.post(
                f"{BASE_URL}/quiz/upload-document",
                files={'file': f},
                headers={'Authorization': f'Bearer {admin_token}'}
            )
        
        if upload_response.ok:
            print(f"✓ Document uploaded")
            os.remove(test_file)
            
            # Re-fetch documents
            docs_response = requests.get(
                f"{BASE_URL}/quiz/uploaded-documents",
                headers={'Authorization': f'Bearer {admin_token}'}
            )
            documents = docs_response.json()['documents']
            selected_doc = documents[0]
        else:
            print("✗ Upload failed")
            exit(1)
else:
    print(f"✗ Failed to list documents")
    exit(1)

# Step 4: Generate quiz
print("\n[Step 4] Generating quiz...")
generate_response = requests.post(
    f"{BASE_URL}/quiz/generate-quiz",
    json={
        "document_path": selected_doc['filepath'],
        "title": f"ML Quiz from {selected_doc['filename']}",
        "description": "Test quiz generated from uploaded document",
        "num_questions": 3
    },
    headers={'Authorization': f'Bearer {admin_token}'}
)

if generate_response.ok:
    quiz_data = generate_response.json()['quiz']
    quiz_id = quiz_data['id']
    print(f"✓ Quiz generated: {quiz_data['title']}")
    print(f"  Questions: {len(quiz_data['questions'])}")
else:
    print(f"✗ Quiz generation failed")
    exit(1)

# Step 5: User login
print("\n[Step 5] User login...")
user_login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": USER_EMAIL, "password": USER_PASSWORD}
)

user_token = user_login.json()['access_token']
print(f"✓ User logged in")

# Step 6: Get quizzes
print("\n[Step 6] User fetches available quizzes...")
quizzes_response = requests.get(
    f"{BASE_URL}/quiz/quizzes",
    headers={'Authorization': f'Bearer {user_token}'}
)

if quizzes_response.ok:
    quizzes = quizzes_response.json()['quizzes']
    print(f"✓ Found {len(quizzes)} quiz(zes)")
else:
    print(f"✗ Failed to fetch quizzes")

# Step 7: Get specific quiz
print("\n[Step 7] User gets quiz details...")
quiz_response = requests.get(
    f"{BASE_URL}/quiz/quizzes/{quiz_id}",
    headers={'Authorization': f'Bearer {user_token}'}
)

if quiz_response.ok:
    quiz = quiz_response.json()['quiz']
    print(f"✓ Quiz loaded: {quiz['title']}")
    
    # Prepare answers
    answers = [q['options'][0] for q in quiz['questions']]
    
    # Step 8: Submit quiz
    print("\n[Step 8] User submits quiz...")
    submit_response = requests.post(
        f"{BASE_URL}/quiz/submit-quiz",
        json={
            "quiz_id": quiz_id,
            "answers": answers
        },
        headers={'Authorization': f'Bearer {user_token}'}
    )
    
    if submit_response.ok:
        result = submit_response.json()
        print(f"✓ Quiz submitted!")
        print(f"  Score: {result['score']}/{result['total']}")
        print(f"  Percentage: {result['percentage']}%")
    else:
        print(f"✗ Submit failed")
else:
    print(f"✗ Failed to get quiz")

print("\n" + "=" * 70)
print("✓ WORKFLOW TEST COMPLETE!")
print("=" * 70)
