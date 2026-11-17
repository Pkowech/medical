from pathlib import Path


FRONTEND_ROOT = Path(__file__).resolve().parents[1]


def read_frontend(path: str) -> str:
    return (FRONTEND_ROOT / path).read_text(encoding="utf-8")


def test_courses_page_lists_classes_without_global_unit_sections():
    dashboard = read_frontend("src/features/courses/components/courses-dashboard.tsx")

    assert "Enrolled classes" in dashboard
    assert "{totalCourseCount}" in dashboard
    assert "Ongoing Units" not in dashboard
    assert "Completed Units" not in dashboard
    assert "title=\"My Units\"" not in dashboard


def test_open_class_always_opens_the_class_roadmap_instead_of_resume_point():
    dashboard = read_frontend("src/features/courses/components/courses-dashboard.tsx")

    assert "const openCourse = () => router.push(`/courses/${encodeURIComponent(course.id)}`);" in dashboard
    assert "getResumePoint" not in dashboard
    assert "courseUnitHref" not in dashboard
    assert "'Continue learning'" not in dashboard


def test_class_roadmap_shows_all_unit_statuses_and_opens_units_without_old_topic_query():
    overview = read_frontend("src/features/courses/components/CourseOverview.tsx")

    assert "Learning roadmap" in overview
    assert "course.units || []" in overview
    assert "const statusLabel = isCompleted ? 'Completed' : isInProgress ? 'Ongoing' : 'Not enrolled';" in overview
    assert "<details" in overview
    assert "router.push(" in overview
    assert "topicId=" not in overview
    assert "String(unit.courseId) === String(courseId)" in overview


def test_topic_completion_is_based_on_assessment_mastery_not_manual_study_status():
    overview = read_frontend("src/features/courses/components/CourseOverview.tsx")
    unit_layout = read_frontend("src/features/courses/components/units/UnitLayout.tsx")
    topic_viewer = read_frontend("src/features/courses/components/TopicViewer.tsx")

    assert "return item?.masteryUnlocked === true;" in overview
    assert "topic?.masteryUnlocked === true" in unit_layout
    assert "Mark topic complete" not in topic_viewer
    assert "progress[`${chapter.id}-${topic.id}`]" not in unit_layout
