#!/usr/bin/env python
"""Debug quiz generation"""

import requests
import json

BASE_URL = "http://127.0.0.1:5000"
ADMIN_EMAIL = "admin@grace-wise.com"
ADMIN_PASSWORD = "grace.admin@123"

# Login
admin_login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)

admin_token = admin_login.json()['access_token']

# Get documents
docs_response = requests.get(
    f"{BASE_URL}/quiz/uploaded-documents",
    headers={'Authorization': f'Bearer {admin_token}'}
)

documents = docs_response.json()['documents']
selected_doc = documents[0]

print(f"Selected document: {selected_doc['filename']}")
print(f"Filepath: {selected_doc['filepath']}")

# Try to generate quiz
generate_response = requests.post(
    f"{BASE_URL}/quiz/generate-quiz",
    json={
        "document_path": selected_doc['filepath'],
        "title": "Test Quiz",
        "description": "Test",
        "num_questions": 3
    },
    headers={'Authorization': f'Bearer {admin_token}'}
)

print(f"Status: {generate_response.status_code}")
print(f"Response: {json.dumps(generate_response.json(), indent=2)}")
