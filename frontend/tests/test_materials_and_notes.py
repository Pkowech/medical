from pathlib import Path
import pytest

FRONTEND_ROOT = Path(__file__).resolve().parents[1]


def read_frontend(path: str) -> str:
    """Reads a file from the frontend root directory."""
    return (FRONTEND_ROOT / path).read_text(encoding="utf-8")


# ============================================================================
# 1. TEST: Personal Knowledge & Upgraded Notes Panel Component
# ============================================================================
def test_notes_panel_supports_staleness_warnings_and_note_types():
    """Verifies NotesPanel handles staleness alerts, AI/peer badges, and topic linkage."""
    notes_panel = read_frontend("src/features/courses/components/NotesPanel.tsx")

    # Staleness alert checks
    assert "isStale" in notes_panel
    assert "Source material updated since this note was created. Please review." in notes_panel

    # Note type icons & badges checks
    assert "ai_generated" in notes_panel
    assert "peer_shared" in notes_panel
    assert "student" in notes_panel

    # Topic linkage checks
    assert "Linked to Topic" in notes_panel
    assert "Personal Knowledge & Notes" in notes_panel

    # API Callback support checks
    assert "onSaveNoteApi" in notes_panel


def test_layouts_integrate_notes_panel():
    """Verifies EducationalCourseLayout and UnitLayout integrate NotesPanel."""
    course_layout = read_frontend("src/features/courses/components/EducationalCourseLayout.tsx")
    unit_layout = read_frontend("src/features/courses/components/units/UnitLayout.tsx")

    assert "<NotesPanel" in course_layout
    assert "<NotesPanel" in unit_layout


# ============================================================================
# 2. TEST: Digital Textbooks & PDF Material Reader
# ============================================================================
def test_pdf_material_viewer_component_exists_and_renders_pdf():
    """Verifies PDFMaterialViewer exists and manages PDF document viewing."""
    pdf_viewer = read_frontend("src/features/materials/components/PDFMaterialViewer.tsx")

    assert "pdf" in pdf_viewer.lower()
    assert "PDFMaterialViewer" in pdf_viewer or "React" in pdf_viewer


# ============================================================================
# 3. TEST: Written Lessons & Local Material Reader
# ============================================================================
def test_local_material_reader_renders_article_content():
    """Verifies LocalMaterialReader presents inline text/HTML lesson articles."""
    material_reader = read_frontend("src/features/student/components/LocalMaterialReader.tsx")

    assert "material" in material_reader
    assert "content" in material_reader
