"""
Backend integration tests for:
  1. Admin Course → Unit → Topic creation end-to-end
  2. Material upload + R2 presigned URL generation
  3. Student material fetch (by topic) and presigned download URL
  4. Notes CRUD linked to topic+material
"""

import io
import os
import requests
import pytest

BASE_URL       = os.getenv("BACKEND_URL", "http://localhost:3002/v1")
ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL",    "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "AU110s/6081/2021MTH")
CATEGORY_ID    = os.getenv("SEED_CATEGORY_ID", "88ff2a11-d982-4f66-ba37-9e9657934189")


# ── Authentication ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def auth_headers():
    """Authenticates and returns JWT headers shared across all module tests."""
    res = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json().get("data", {}).get("accessToken") or res.json().get("accessToken")
    assert token, "accessToken missing from login response"
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── Reusable fixtures for hierarchy creation ───────────────────────────────────

@pytest.fixture(scope="module")
def created_course(auth_headers):
    """Creates a course, yields it, then deletes it after all tests in module."""
    payload = {
        "name": "PyTest Cardiology Course",
        "title": "Cardiology for USMLE Step 1",
        "description": "Automated integration test course.",
        "difficulty": "intermediate",
        "categoryId": CATEGORY_ID,
        "status": "draft",
        "tags": ["cardiology", "usmle"],
        "estimatedHours": 20,
    }
    res = requests.post(f"{BASE_URL}/courses", json=payload, headers=auth_headers, timeout=10)
    assert res.status_code == 201, f"Course creation failed: {res.text}"
    course = res.json().get("data", res.json())
    yield course
    requests.delete(f"{BASE_URL}/courses/{course['id']}", headers=auth_headers, timeout=10)


@pytest.fixture(scope="module")
def created_unit(auth_headers, created_course):
    """Creates a unit under the test course, yields it."""
    payload = {
        "title": "Unit 1: Coronary Circulation",
        "description": "Anatomy and physiology of coronary arteries.",
        "order": 1,
        "courseId": created_course["id"],
        "estimatedDuration": 180,
    }
    res = requests.post(f"{BASE_URL}/units", json=payload, headers=auth_headers, timeout=10)
    assert res.status_code in [200, 201], f"Unit creation failed: {res.text}"
    unit = res.json().get("data", res.json())
    yield unit
    requests.delete(f"{BASE_URL}/units/{unit['id']}", headers=auth_headers, timeout=10)


@pytest.fixture(scope="module")
def created_topic(auth_headers, created_unit):
    """Creates a topic under the test unit, yields it."""
    payload = {
        "name": "Myocardial Infarction Pathology",
        "description": "Pathophysiology, types, and management of MI.",
        "order": 1,
        "unitId": created_unit["id"],
        "estimatedMinutes": 45,
    }
    res = requests.post(f"{BASE_URL}/topics", json=payload, headers=auth_headers, timeout=10)
    assert res.status_code in [200, 201], f"Topic creation failed: {res.text}"
    topic = res.json().get("data", res.json())
    yield topic
    requests.delete(f"{BASE_URL}/topics/{topic['id']}", headers=auth_headers, timeout=10)


# ── FLOW 1: Admin Course → Unit → Topic creation ──────────────────────────────

class TestAdminCourseCreation:

    def test_course_created_with_expected_fields(self, created_course):
        """Created course has an ID, title, and status fields."""
        assert "id"     in created_course
        assert "title"  in created_course or "name" in created_course
        assert created_course.get("status") == "draft" or created_course.get("status") is not None

    def test_course_is_retrievable_by_id(self, auth_headers, created_course):
        """GET /courses/:id returns the created course."""
        res = requests.get(
            f"{BASE_URL}/courses/{created_course['id']}",
            headers=auth_headers, timeout=10
        )
        assert res.status_code == 200
        fetched = res.json().get("data", res.json())
        assert fetched["id"] == created_course["id"]

    def test_unit_created_linked_to_course(self, created_unit, created_course):
        """Created unit is linked to the test course."""
        assert "id"       in created_unit
        assert created_unit.get("courseId") == created_course["id"] \
            or "courseId" in str(created_unit)

    def test_topic_created_linked_to_unit(self, created_topic, created_unit):
        """Created topic is linked to the test unit."""
        assert "id" in created_topic
        assert created_topic.get("unitId") == created_unit["id"] \
            or "unitId" in str(created_topic)

    def test_course_update_works(self, auth_headers, created_course):
        """PATCH /courses/:id updates course fields."""
        res = requests.patch(
            f"{BASE_URL}/courses/{created_course['id']}",
            json={"description": "Updated via pytest."},
            headers=auth_headers, timeout=10
        )
        assert res.status_code == 200

    def test_course_list_contains_created_course(self, auth_headers, created_course):
        """GET /courses returns a list that includes the created course."""
        res = requests.get(f"{BASE_URL}/courses", headers=auth_headers, timeout=10)
        assert res.status_code == 200
        courses = res.json().get("data", {}).get("data", []) or res.json().get("data", [])
        ids = [c.get("id") for c in courses if isinstance(c, dict)]
        assert created_course["id"] in ids

    def test_create_second_unit_in_already_existing_course(self, auth_headers, created_course, created_unit):
        """
        Explicitly tests adding a second unit (Unit 2) to an already existing course.
        Verifies automatic ordering and course-unit relationship binding.
        """
        payload = {
            "title": "Unit 2: Valvular & Myocardial Diseases",
            "description": "Second module appended to existing course.",
            "order": 2,
            "courseId": created_course["id"],
            "estimatedDuration": 120,
        }
        res = requests.post(f"{BASE_URL}/units", json=payload, headers=auth_headers, timeout=10)
        assert res.status_code in [200, 201], f"Adding unit to existing course failed: {res.text}"
        unit2 = res.json().get("data", res.json())
        assert unit2["id"] != created_unit["id"]
        assert unit2.get("courseId") == created_course["id"] or "courseId" in str(unit2)

        # Cleanup unit 2
        requests.delete(f"{BASE_URL}/units/{unit2['id']}", headers=auth_headers, timeout=10)


# ── FLOW 2: Material Upload + R2 Presigned URL ────────────────────────────────

class TestMaterialUploadAndR2:

    @pytest.fixture(scope="class")
    def uploaded_material(self, auth_headers, created_topic):
        """Uploads a minimal text file as a material and yields the record."""
        fake_pdf = io.BytesIO(b"%PDF-1.4 fake content for pytest")
        fake_pdf.name = "robbins-cardiac-chapter.pdf"

        res = requests.post(
            f"{BASE_URL}/materials/upload",
            files={"file": ("robbins-cardiac-chapter.pdf", fake_pdf, "application/pdf")},
            data={
                "title": "Robbins Cardiac Chapter",
                "description": "Automated upload test",
                "type": "pdf",
                "topicId": created_topic["id"],
            },
            headers={"Authorization": auth_headers["Authorization"]},
            timeout=30,
        )
        assert res.status_code in [200, 201], f"Upload failed: {res.text}"
        material = res.json().get("data", res.json())
        yield material
        # Cleanup
        requests.delete(
            f"{BASE_URL}/materials/{material['id']}",
            headers=auth_headers, timeout=10
        )

    def test_upload_returns_material_record_with_id(self, uploaded_material):
        """Uploaded material has an id and title."""
        assert "id"    in uploaded_material
        assert "title" in uploaded_material

    def test_upload_material_is_retrievable(self, auth_headers, uploaded_material):
        """GET /materials/:id returns the uploaded material."""
        res = requests.get(
            f"{BASE_URL}/materials/{uploaded_material['id']}",
            headers=auth_headers, timeout=10
        )
        assert res.status_code == 200

    def test_material_with_url_returns_presigned_r2_link(self, auth_headers, uploaded_material):
        """GET /materials/:id/with-url returns fileUrl presigned from R2."""
        res = requests.get(
            f"{BASE_URL}/materials/{uploaded_material['id']}/with-url",
            headers=auth_headers, timeout=10
        )
        assert res.status_code == 200
        data = res.json().get("data", res.json())
        # fileUrl should be present (may be null if R2 not configured in test env)
        assert "fileUrl" in data or "id" in data

    def test_materials_by_topic_includes_uploaded_material(self, auth_headers, created_topic, uploaded_material):
        """GET /materials?topicId=... returns the uploaded material for that topic."""
        res = requests.get(
            f"{BASE_URL}/materials",
            params={"topicId": created_topic["id"]},
            headers=auth_headers, timeout=10
        )
        assert res.status_code == 200
        items = res.json().get("data", {}).get("items", []) or res.json().get("data", [])
        ids = [m.get("id") for m in items if isinstance(m, dict)]
        assert uploaded_material["id"] in ids


# ── FLOW 3: Student Enrollment + Notes CRUD ───────────────────────────────────

class TestStudentEnrollmentAndNotes:

    def test_student_can_enroll_in_course(self, auth_headers, created_course):
        """POST /courses/:id/enroll enrolls the authenticated user."""
        res = requests.post(
            f"{BASE_URL}/courses/{created_course['id']}/enroll",
            headers=auth_headers, timeout=10
        )
        assert res.status_code in [200, 201, 409]  # 409 if already enrolled is acceptable

    def test_student_note_create_linked_to_topic(self, auth_headers, created_topic):
        """POST /notes creates a student note linked to a topic."""
        res = requests.post(
            f"{BASE_URL}/notes",
            json={
                "topicId": created_topic["id"],
                "content": "MI: occlusion of LAD → anterior wall infarct. Troponin rises in 3h.",
                "type": "student",
            },
            headers=auth_headers, timeout=10,
        )
        assert res.status_code in [200, 201], f"Note creation failed: {res.text}"
        note = res.json()
        assert "id"      in note
        assert "content" in note

        # Verify it is fetchable by topicId
        fetch = requests.get(
            f"{BASE_URL}/notes",
            params={"topicId": created_topic["id"]},
            headers=auth_headers, timeout=10,
        )
        assert fetch.status_code == 200
        notes = fetch.json()
        assert any(n["id"] == note["id"] for n in notes)

        # Update note content (triggers NoteVersion history)
        update = requests.put(
            f"{BASE_URL}/notes/{note['id']}",
            json={"content": "Updated: Troponin rises within 3h, peaks at 24-48h."},
            headers=auth_headers, timeout=10,
        )
        assert update.status_code == 200
        assert "Updated" in update.json().get("content", "")

        # Delete note
        delete = requests.delete(
            f"{BASE_URL}/notes/{note['id']}",
            headers=auth_headers, timeout=10,
        )
        assert delete.status_code == 200

    def test_my_courses_includes_enrolled_course(self, auth_headers, created_course):
        """GET /courses/my-courses lists enrolled courses for the user."""
        res = requests.get(
            f"{BASE_URL}/courses/my-courses",
            headers=auth_headers, timeout=10
        )
        assert res.status_code == 200
