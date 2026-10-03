"""
Frontend static-analysis tests for:
  1. Admin Course Creation & Structure  (/admin/content)
  2. Admin Material Upload + R2 binding (/admin/materials/upload + FileUpload.tsx)
  3. Student Topic Reading Page         (/courses/[courseId]/units/[unitId]/topics/[topicId])
"""

from pathlib import Path
import pytest

FRONTEND_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT  = FRONTEND_ROOT.parent / "backend"


def fe(path: str) -> str:
    """Read a file from the frontend root."""
    return (FRONTEND_ROOT / path).read_text(encoding="utf-8")


def be(path: str) -> str:
    """Read a file from the backend root."""
    return (BACKEND_ROOT / path).read_text(encoding="utf-8")


# ============================================================================
# FLOW 1 – Admin Course Creation & Structure  (/admin/content)
# ============================================================================
class TestAdminCourseCreation:
    """
    Verifies that the /admin/content page can create, update, and delete
    the full Course → Unit → Topic hierarchy.
    """

    def test_admin_content_page_imports_all_three_forms(self):
        """Page imports CourseForm, UnitForm, and TopicForm."""
        page = fe("src/app/admin/content/page.tsx")
        assert "CourseForm" in page
        assert "UnitForm"   in page
        assert "TopicForm"  in page

    def test_admin_content_uses_real_service_calls(self):
        """Page calls courseService, unitService, topicService for CRUD."""
        page = fe("src/app/admin/content/page.tsx")
        assert "courseService.getCourses"   in page
        assert "courseService.createCourse" in page
        assert "courseService.updateCourse" in page
        assert "courseService.deleteCourse" in page
        assert "unitService.createUnit"     in page
        assert "unitService.updateUnit"     in page
        assert "unitService.deleteUnit"     in page
        assert "topicService.createTopic"   in page
        assert "topicService.updateTopic"   in page

    def test_admin_content_wires_error_and_success_feedback(self):
        """Page surfaces user-facing success/error messages."""
        page = fe("src/app/admin/content/page.tsx")
        assert "setSuccessMessage" in page
        assert "setError"          in page
        assert "Course created successfully"  in page
        assert "Unit created successfully"    in page
        assert "Topic created successfully"   in page

    def test_admin_content_guards_form_state(self):
        """Page uses FormContext mode to avoid simultaneous form renders."""
        page = fe("src/app/admin/content/page.tsx")
        assert "FormMode"      in page
        assert "formContext"   in page
        assert "'course'"      in page
        assert "'unit'"        in page
        assert "'topic'"       in page
        assert "mode: 'none'"  in page

    def test_admin_can_add_unit_to_already_existing_course(self):
        """
        Verifies that /admin/content allows adding a new unit to an already existing course
        by passing formContext.course?.id to unitService.createUnit and updating state.
        """
        page = fe("src/app/admin/content/page.tsx")
        assert "unitService.createUnit(formContext.course?.id" in page
        assert "units: [...(c.units || []), newUnit]" in page

    def test_unit_service_binds_new_unit_to_existing_course_id(self):
        """
        Verifies that unitService.createUnit requires courseId as parameter
        and posts it in the request body to the backend.
        """
        unit_svc = fe("src/features/courses/services/unitService.ts")
        assert "createUnit(courseId: string" in unit_svc
        assert "courseId," in unit_svc
        assert "apiService.post<Unit>" in unit_svc

    def test_admin_can_add_topic_to_already_existing_unit(self):
        """
        Verifies that /admin/content allows adding a topic to an existing unit
        by passing formContext.unit?.id to topicService.createTopic.
        """
        page = fe("src/app/admin/content/page.tsx")
        assert "topicService.createTopic(formContext.unit?.id" in page
        assert "topics: [...(u.topics || []), newTopic]" in page


# ============================================================================
# FLOW 2 – Admin Material Upload + R2 binding
# ============================================================================
class TestAdminMaterialUploadAndR2:
    """
    Verifies that the upload page and FileUpload component correctly
    wire into the material service which presigns R2 uploads.
    """

    def test_upload_page_mounts_file_upload_component(self):
        """The admin upload page renders FileUpload."""
        page = fe("src/app/admin/materials/upload/page.tsx")
        assert "<FileUpload" in page
        assert "onUploadComplete" in page

    def test_upload_page_permits_pdf_and_office_formats(self):
        """Upload page explicitly allows pdf, docx, pptx, txt, md, images."""
        page = fe("src/app/admin/materials/upload/page.tsx")
        assert ".pdf"  in page
        assert ".docx" in page
        assert ".pptx" in page
        assert ".txt"  in page
        assert ".md"   in page

    def test_file_upload_component_calls_material_service_upload(self):
        """FileUpload.tsx calls materialService.uploadMaterial with FormData."""
        component = fe("src/shared/components/forms/FileUpload.tsx")
        assert "materialService.uploadMaterial" in component
        assert "FormData"                       in component
        assert "onUploadProgress"               in component

    def test_file_upload_validates_size_and_type_before_send(self):
        """FileUpload enforces max file size and allowed types client-side."""
        component = fe("src/shared/components/forms/FileUpload.tsx")
        assert "maxFileSizeMB" in component
        assert "allowedFileTypes" in component
        assert "File size exceeds the maximum limit" in component
        assert "File type not supported" in component

    def test_material_service_points_to_correct_upload_endpoint(self):
        """materialService POSTs to /materials/upload with multipart header."""
        svc = fe("src/features/courses/services/materialService.ts")
        assert "'/materials/upload'" in svc
        assert "multipart/form-data"  in svc

    def test_material_service_supports_get_material_with_file_url(self):
        """materialService exposes getMaterialWithFileUrl for R2 presigned download."""
        svc = fe("src/features/courses/services/materialService.ts")
        assert "getMaterialWithFileUrl"  in svc
        assert "/with-url"               in svc

    def test_material_service_exposes_topic_scoped_fetch(self):
        """materialService can fetch all materials for a given topicId."""
        svc = fe("src/features/courses/services/materialService.ts")
        assert "getMaterialsByTopicId" in svc
        assert "topicId"               in svc

    def test_storage_service_uses_r2_env_vars(self):
        """StorageService reads R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_BUCKET_NAME."""
        storage = be("src/infrastructure/storage/storage.service.ts")
        assert "R2_ENDPOINT"          in storage
        assert "R2_ACCESS_KEY_ID"     in storage
        assert "R2_SECRET_ACCESS_KEY" in storage
        assert "R2_BUCKET_NAME"       in storage

    def test_storage_service_generates_presigned_upload_url(self):
        """StorageService.getPresignedUploadUrl uses PutObjectCommand."""
        storage = be("src/infrastructure/storage/storage.service.ts")
        assert "getPresignedUploadUrl"  in storage
        assert "PutObjectCommand"       in storage
        assert "getSignedUrl"           in storage

    def test_storage_service_generates_presigned_download_url(self):
        """StorageService.getPresignedDownloadUrl uses GetObjectCommand."""
        storage = be("src/infrastructure/storage/storage.service.ts")
        assert "getPresignedDownloadUrl" in storage
        assert "GetObjectCommand"        in storage
        assert "ResponseContentType"     in storage


# ============================================================================
# FLOW 3 – Student Topic Reading Page + Material Readers + Notes
# ============================================================================
class TestStudentTopicReadingPage:
    """
    Verifies that the topic page correctly presents materials to students
    and is integrated with material readers and the upgraded NotesPanel.
    """

    def test_topic_page_exists_for_student_route(self):
        """Nested topic route file exists for students."""
        topic_page = FRONTEND_ROOT / "src/app/(app)/courses/[courseId]/units/[unitId]/topics/[topicId]/page.tsx"
        assert topic_page.exists(), f"Missing topic page at {topic_page}"

    def test_pdf_material_viewer_is_a_react_component(self):
        """PDFMaterialViewer.tsx exists and handles PDF rendering."""
        viewer = fe("src/features/materials/components/PDFMaterialViewer.tsx")
        assert "PDFMaterialViewer" in viewer or "pdf" in viewer.lower()

    def test_local_material_reader_accepts_local_files_and_saves_metadata(self):
        """LocalMaterialReader displays picked files and stores their metadata locally."""
        reader = fe("src/features/student/components/LocalMaterialReader.tsx")
        assert 'accept=".pdf,.txt,.md"' in reader
        assert "<pre>{fileContent}</pre>" in reader
        assert "offlineService.saveLocalFileMetadata(metadata)" in reader

    def test_notes_panel_embedded_in_unit_layout(self):
        """UnitLayout.tsx embeds NotesPanel as a companion to lesson content."""
        layout = fe("src/features/courses/components/units/UnitLayout.tsx")
        assert "NotesPanel"   in layout
        assert "<NotesPanel"  in layout

    def test_notes_panel_embedded_in_educational_course_layout(self):
        """EducationalCourseLayout also embeds NotesPanel."""
        layout = fe("src/features/courses/components/EducationalCourseLayout.tsx")
        assert "NotesPanel"  in layout
        assert "<NotesPanel" in layout

    def test_notes_panel_upgraded_with_staleness_and_type_badges(self):
        """NotesPanel shows staleness warnings and student/ai/peer badges."""
        panel = fe("src/features/courses/components/NotesPanel.tsx")
        assert "isStale"       in panel
        assert "ai_generated"  in panel
        assert "peer_shared"   in panel
        assert "student"       in panel
        assert "Source material updated since this note was created. Please review." in panel

    def test_notes_panel_supports_api_save_callback(self):
        """NotesPanel accepts onSaveNoteApi for wiring to the /notes endpoint."""
        panel = fe("src/features/courses/components/NotesPanel.tsx")
        assert "onSaveNoteApi" in panel

    def test_notes_panel_backward_compatible_with_legacy_props(self):
        """NotesPanel still accepts lessonKey+saveNote for existing callers."""
        panel = fe("src/features/courses/components/NotesPanel.tsx")
        assert "lessonKey"  in panel
        assert "saveNote"   in panel
