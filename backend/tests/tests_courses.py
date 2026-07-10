import requests
import pytest
import os

# Assuming the backend is running on localhost:3002
BASE_URL = os.getenv('BACKEND_URL', 'http://localhost:3002/v1')

# Credentials for a seeded admin user from backend/prisma/seed.ts
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "AU110s/6081/2021MTH"

# ID for integration-test@example.com, used for enrollment tests
TEST_USER_ID = "test-user-integration"

@pytest.fixture(scope="module")
def auth_headers():
    """Logs in a user and returns authentication headers with a valid JWT token."""
    login_url = f"{BASE_URL}/auth/login" # Corrected URL to include /v1 prefix
    login_response = requests.post(login_url, json={'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD})
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    token = login_response.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

@pytest.fixture(scope="module")
def created_course_id(auth_headers):
    """Creates a course for testing and yields its ID."""
    response = requests.post(f"{BASE_URL}/courses", json=TEST_COURSE_DATA, headers=auth_headers)
    assert response.status_code == 201
    course_id = response.json()["data"]["id"] # Corrected to access nested 'data'
    yield course_id
    # Clean up: Delete the course after tests
    delete_response = requests.delete(f"{BASE_URL}/courses/{course_id}", headers=auth_headers)
    assert delete_response.status_code == 204

# Test data (re-adding this as the file was recreated)
TEST_COURSE_DATA = {
    "name": "Test Course",
    "title": "Introduction to Testing",
    "description": "A comprehensive course on backend testing.",
    "difficulty": "beginner",
    "categoryId": "88ff2a11-d982-4f66-ba37-9e9657934189",  # General Medicine category from seed
    "status": "published",  # Changed from draft to published for enrollment testing
    "price": 0,
    "tags": ["testing", "backend", "python"],
    "estimatedHours": 10
}

def test_get_all_courses_unauthenticated():
    """Test retrieving all courses without authentication."""
    response = requests.get(f"{BASE_URL}/courses")
    assert response.status_code == 200
    assert "data" in response.json()
    assert "data" in response.json()["data"] # Corrected to access nested 'data'
    assert isinstance(response.json()["data"]["data"], list) # Corrected to access nested 'data'

def test_create_course(auth_headers):
    """Test creating a new course."""
    response = requests.post(f"{BASE_URL}/courses", json=TEST_COURSE_DATA, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["data"]["name"] == TEST_COURSE_DATA["name"] # Corrected to access nested 'data'
    course_id = response.json()["data"]["id"] # Corrected to access nested 'data'
    # Clean up the created course immediately to avoid interference with other tests
    requests.delete(f"{BASE_URL}/courses/{course_id}", headers=auth_headers)

def test_get_course_by_id(auth_headers, created_course_id):
    """Test retrieving a single course by ID."""
    response = requests.get(f"{BASE_URL}/courses/{created_course_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["data"]["id"] == created_course_id # Corrected to access nested 'data'
    assert response.json()["data"]["name"] == TEST_COURSE_DATA["name"] # Corrected to access nested 'data'

def test_update_course(auth_headers, created_course_id):
    """Test updating an existing course."""
    updated_data = {"title": "Advanced Backend Testing"}
    response = requests.patch(f"{BASE_URL}/courses/{created_course_id}", json=updated_data, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["data"]["title"] == updated_data["title"] # Corrected to access nested 'data'

def test_enroll_in_course(auth_headers, created_course_id):
    """Test enrolling a user in a course."""
    response = requests.post(f"{BASE_URL}/courses/{created_course_id}/enroll", headers=auth_headers)
    assert response.status_code == 201

    # Clean up: Unenroll immediately to avoid interference
    unenroll_response = requests.delete(f"{BASE_URL}/courses/{created_course_id}/enroll", headers=auth_headers)
    assert unenroll_response.status_code == 204

def test_get_user_course_stats(auth_headers):
    """Test retrieving user course statistics."""
    response = requests.get(f"{BASE_URL}/courses/stats", headers=auth_headers)
    assert response.status_code == 200
    assert "totalEnrolled" in response.json()["data"] # Corrected to access nested 'data'
    assert "completed" in response.json()["data"] # Corrected to access nested 'data'

# You might need to add more specific tests for pagination, filtering,
# error cases (e.g., 404 for non-existent course, 403 for unauthorized actions),
# and different user roles.
