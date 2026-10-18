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

    assert 'accept=".pdf,.txt,.md"' in material_reader
    assert "<pre>{fileContent}</pre>" in material_reader


def test_course_library_row_opens_roadmap_independently_from_resource_toggle():
    """Course navigation and resource expansion must use separate controls."""
    materials_dashboard = read_frontend("src/features/materials/components/materials-dashboard.tsx")

    assert 'aria-label={`Open ${course.title} roadmap`}' in materials_dashboard
    assert 'Open roadmap' in materials_dashboard
    assert 'aria-expanded={isSectionOpen(`course:${course.id}`, false)}' in materials_dashboard
    assert 'aria-label={`${isSectionOpen(`course:${course.id}`, false) ? \'Collapse\' : \'Expand\'} ${course.title} resources`}' in materials_dashboard
    assert 'onClick={() => setSectionOpen(' in materials_dashboard


def test_material_library_uses_consistent_concise_tab_labels():
    """Library tabs name each collection without repeating a heading and description."""
    materials_dashboard = read_frontend("src/features/materials/components/materials-dashboard.tsx")

    assert "{ id: 'owned', label: 'My materials', icon: Database }" in materials_dashboard
    assert "{ id: 'shared', label: 'Shared materials', icon: BookOpen }" in materials_dashboard
    assert 'label: \'My Drive\'' not in materials_dashboard
    assert 'label: \'Shared with me\'' not in materials_dashboard
    assert 'Keep your study resources organized by course, unit, and topic.' not in materials_dashboard


def test_recommended_materials_view_avoids_repeated_intro_copy():
    """The For You tab should not repeat its label in a second page heading."""
    materials_dashboard = read_frontend("src/features/materials/components/materials-dashboard.tsx")

    assert "label: 'For You'" in materials_dashboard
    assert 'Curated for your goals' not in materials_dashboard
    assert 'Recommendations appear when a quiz result is below 70%' in materials_dashboard


def test_resource_type_filter_is_compact_and_applied_to_material_query():
    """Resource filters stay in the control card and drive the paginated request."""
    materials_dashboard = read_frontend("src/features/materials/components/materials-dashboard.tsx")

    assert 'aria-label="Filter by resource type"' in materials_dashboard
    assert 'onClick={() => setMaterialTypeFilter(filter.id)}' in materials_dashboard
    assert 'aria-pressed={materialTypeFilter === filter.id}' in materials_dashboard
    assert "queryKey: ['materials', debouncedSearch, materialTypeFilter" in materials_dashboard
    assert "type: materialTypeFilter === 'all' ? undefined : materialTypeFilter" in materials_dashboard


def test_pdf_page_navigation_scrolls_inside_the_document_viewer():
    """Changing PDF pages should not scroll the outer page on touch screens."""
    pdf_viewer = read_frontend("src/shared/components/pdf/PDFViewer.tsx")
    dashboard_layout = read_frontend("src/core/app/components/layout/DashboardLayout.tsx")

    assert 'scrollContainerRef.current' in pdf_viewer
    assert 'scrollRoot.scrollTo(' in pdf_viewer
    assert 'scrollIntoView(' not in pdf_viewer
    assert "isMaterialViewPage && 'h-full flex flex-col'" in dashboard_layout
    assert "isMaterialViewPage && 'h-full py-0'" in dashboard_layout


def test_material_reader_controls_fit_into_a_compact_mobile_toolbar():
    """Mobile reader actions remain accessible without wrapping into extra rows."""
    material_page = read_frontend("src/app/(app)/study-planner/materials/[id]/page.tsx")
    pdf_viewer = read_frontend("src/shared/components/pdf/PDFViewer.tsx")

    assert 'flex-nowrap items-center justify-between gap-1 sm:mb-3' in material_page
    assert 'aria-label="Share material"' in material_page
    assert 'aria-label="Enter focus mode"' in material_page
    assert 'aria-label="Download original"' in material_page
    assert 'aria-label="Delete material"' in material_page
    assert 'sr-only sm:not-sr-only' in material_page
    assert 'bg-card p-1 dark:border-border dark:bg-card sm:flex' in pdf_viewer
    assert 'h-7 w-7 p-0 sm:h-8 sm:w-8' in pdf_viewer
