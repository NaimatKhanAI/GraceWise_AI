#!/usr/bin/env python
"""Test uploaded documents listing"""

import requests

BASE_URL = "http://127.0.0.1:5000"
ADMIN_EMAIL = "admin@grace-wise.com"
ADMIN_PASSWORD = "grace.admin@123"

print("=" * 70)
print("TEST: Uploaded Documents List")
print("=" * 70)

# Login as admin
print("\n[Step 1] Admin login...")
admin_login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)

if admin_login.status_code != 200:
    print(f"✗ Admin login failed")
    exit(1)

admin_token = admin_login.json()['access_token']
print(f"✓ Admin logged in")

# Get uploaded documents
print("\n[Step 2] Getting uploaded documents list...")
response = requests.get(
    f"{BASE_URL}/quiz/uploaded-documents",
    headers={'Authorization': f'Bearer {admin_token}'}
)

print(f"Status: {response.status_code}")
data = response.json()

if response.ok:
    documents = data.get('documents', [])
    print(f"✓ Found {len(documents)} document(s):")
    for doc in documents:
        print(f"  - {doc['filename']}")
else:
    print(f"✗ Failed: {data}")

print("\n" + "=" * 70)
