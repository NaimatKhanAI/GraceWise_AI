#!/usr/bin/env python
"""Test script to verify the quiz upload endpoint"""

import requests
import json

# Test configuration
BASE_URL = "http://127.0.0.1:5000"
ADMIN_EMAIL = "admin@grace-wise.com"
ADMIN_PASSWORD = "grace.admin@123"

print("=" * 60)
print("Quiz Upload Endpoint Test")
print("=" * 60)

# Step 1: Login as admin
print("\n[Step 1] Logging in as admin...")
login_response = requests.post(
    f"{BASE_URL}/auth/login",
    json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
)

if login_response.status_code != 200:
    print(f"✗ Login failed: {login_response.status_code}")
    print(f"Response: {login_response.json()}")
    exit(1)

login_data = login_response.json()
access_token = login_data['access_token']
user = login_data['user']

print(f"✓ Login successful!")
print(f"  User: {user['first_name']} {user['last_name']}")
print(f"  Email: {user['email']}")
print(f"  Is Admin: {user.get('is_admin', False)}")
print(f"  Token: {access_token[:50]}...")

# Step 2: Test upload endpoint
print("\n[Step 2] Testing document upload...")

# Create a test file
test_file_path = "test_document.txt"
with open(test_file_path, 'w') as f:
    f.write("This is a test document for quiz generation.\n")
    f.write("It contains some sample content.\n")
    f.write("This should be enough for testing.")

try:
    # Upload the file
    with open(test_file_path, 'rb') as f:
        files = {'file': f}
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        
        print(f"Sending POST request to /quiz/upload-document...")
        print(f"  Authorization header: Bearer {access_token[:30]}...")
        print(f"  File: {test_file_path}")
        
        response = requests.post(
            f"{BASE_URL}/quiz/upload-document",
            files=files,
            headers=headers
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 201:
            print("\n✓ Upload successful!")
            data = response.json()
            print(f"  Message: {data['message']}")
            print(f"  Filename: {data.get('filename')}")
        else:
            print(f"\n✗ Upload failed!")
            try:
                print(f"  Error: {response.json()}")
            except:
                print(f"  Response: {response.text}")
                
finally:
    # Cleanup
    import os
    if os.path.exists(test_file_path):
        os.remove(test_file_path)
        print(f"\nTest file cleaned up.")

print("\n" + "=" * 60)
