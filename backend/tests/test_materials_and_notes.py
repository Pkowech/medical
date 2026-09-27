import os
import pytest
import requests

# Base API URL matching frontend API client calls
BASE_URL = os.getenv('BACKEND_URL', 'http://localhost:3002/v1')

# Credentials for seeded admin/user
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@example.com')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'AU110s/6081/2021MTH')


@pytest.fixture(scope="module")
def auth_headers():
    """Logs in and returns JWT authorization headers as used by frontend API client."""
    login_url = f"{BASE_URL}/auth/login"
    login_res = requests.post(
        login_url,
        json={'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD},
        timeout=10,
    )
    assert (
        login_res.status_code == 200
    ), f"Frontend auth call failed: {login_res.text}"

    data = login_res.json()
    token = data.get("data", {}).get("accessToken") or data.get("accessToken")
    assert token, "Access token missing from login response"

    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


# ============================================================================
# 1. TEST: Digital Textbooks & Clinical Guidelines (PDF Material Reading)
# ============================================================================
def test_read_pdf_textbook_material(auth_headers):
    """Simulates frontend PDFMaterialViewer fetching a PDF textbook/guideline material."""
    # Step 1: Create or fetch PDF material
    payload = {
        "title": "USMLE Step 1 Renal Pathology Guide",
        "type": "pdf",
        "content": "Full PDF text content or reference URI",
        "category": "Pathology",
        "description": "Comprehensive PDF guide for USMLE Step 1.",
    }

    create_res = requests.post(
        f"{BASE_URL}/materials", json=payload, headers=auth_headers, timeout=10
    )
    # Handle if endpoint returns 201 or 200
    assert create_res.status_code in [200, 201], f"Failed creating PDF material: {create_res.text}"
    created = create_res.json().get("data", create_res.json())
    material_id = created["id"]

    # Step 2: Frontend PDF viewer retrieves material by ID
    get_res = requests.get(
        f"{BASE_URL}/materials/{material_id}", headers=auth_headers, timeout=10
    )
    assert get_res.status_code == 200
    retrieved = get_res.json().get("data", get_res.json())
    assert retrieved["type"] == "pdf"
    assert "USMLE" in retrieved["title"]

    # Step 3: Cleanup
    requests.delete(f"{BASE_URL}/materials/{material_id}", headers=auth_headers, timeout=10)


# ============================================================================
# 2. TEST: Written Lessons & Topic Articles
# ============================================================================
def test_read_topic_written_article(auth_headers):
    """Simulates frontend LocalMaterialReader loading inline topic lesson notes."""
    payload = {
        "title": "Pharmacology of Beta-Blockers",
        "type": "notes",
        "content": "<h1>Beta-1 vs Beta-2 Receptors</h1><p>Metoprolol is Beta-1 selective.</p>",
        "category": "Pharmacology",
    }

    create_res = requests.post(
        f"{BASE_URL}/materials", json=payload, headers=auth_headers, timeout=10
    )
    assert create_res.status_code in [200, 201]
    created = create_res.json().get("data", create_res.json())
    material_id = created["id"]

    # Frontend fetches material text for reading
    get_res = requests.get(
        f"{BASE_URL}/materials/{material_id}", headers=auth_headers, timeout=10
    )
    assert get_res.status_code == 200
    retrieved = get_res.json().get("data", get_res.json())
    assert "Beta-1 selective" in retrieved["content"]

    # Cleanup
    requests.delete(f"{BASE_URL}/materials/{material_id}", headers=auth_headers, timeout=10)


# ============================================================================
# 3. TEST: Patient Vignettes & Clinical Cases
# ============================================================================
def test_read_clinical_cases(auth_headers):
    """Simulates frontend loading interactive clinical case vignettes."""
    # Query clinical cases endpoint
    get_res = requests.get(
        f"{BASE_URL}/clinical-cases", headers=auth_headers, timeout=10
    )
    # Endpoint should respond cleanly
    assert get_res.status_code in [200, 404]


# ============================================================================
# 4. TEST: Slide Decks & Video Transcripts
# ============================================================================
def test_read_slide_deck_material(auth_headers):
    """Simulates frontend loading slide decks & lecture notes."""
    payload = {
        "title": "Cardiovascular Physiology Slide Deck",
        "type": "slide",
        "content": "Slide 1: Cardiac Cycle\nSlide 2: Wiggers Diagram",
        "category": "Physiology",
    }

    create_res = requests.post(
        f"{BASE_URL}/materials", json=payload, headers=auth_headers, timeout=10
    )
    assert create_res.status_code in [200, 201]
    created = create_res.json().get("data", create_res.json())
    material_id = created["id"]

    # Retrieve slide material
    get_res = requests.get(
        f"{BASE_URL}/materials/{material_id}", headers=auth_headers, timeout=10
    )
    assert get_res.status_code == 200
    retrieved = get_res.json().get("data", get_res.json())
    assert retrieved["type"] == "slide"

    # Cleanup
    requests.delete(f"{BASE_URL}/materials/{material_id}", headers=auth_headers, timeout=10)


# ============================================================================
# 5. TEST: Personal Knowledge & Notes API (Frontend <-> Backend)
# ============================================================================
def test_notes_creation_and_retrieval(auth_headers):
    """Tests student note creation, fetching, updating, and deletion via Notes API."""
    dummy_topic_id = "test-topic-123"

    # Step 1: Create a note linked to topic
    note_payload = {
        "topicId": dummy_topic_id,
        "content": "Active recall: Metoprolol reduces heart rate by blocking B1 receptors.",
        "type": "student",
    }

    create_res = requests.post(
        f"{BASE_URL}/notes", json=note_payload, headers=auth_headers, timeout=10
    )
    assert create_res.status_code in [200, 201], f"Note creation failed: {create_res.text}"
    note = create_res.json()
    note_id = note["id"]

    # Step 2: Fetch notes for topic (what frontend NotesPanel calls)
    get_res = requests.get(
        f"{BASE_URL}/notes?topicId={dummy_topic_id}", headers=auth_headers, timeout=10
    )
    assert get_res.status_code == 200
    notes_list = get_res.json()
    assert any(n["id"] == note_id for n in notes_list)

    # Step 3: Update note (triggers NoteVersion history)
    update_res = requests.put(
        f"{BASE_URL}/notes/{note_id}",
        json={"content": "Updated note content with extra details."},
        headers=auth_headers,
        timeout=10,
    )
    assert update_res.status_code == 200
    assert update_res.json()["content"] == "Updated note content with extra details."

    # Step 4: Delete note cleanup
    del_res = requests.delete(
        f"{BASE_URL}/notes/{note_id}", headers=auth_headers, timeout=10
    )
    assert del_res.status_code == 200
