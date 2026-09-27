"""Read-only integration checks for the Pharmacology PPB 311 study flow."""

import os
from pathlib import Path

import psycopg2
import pytest
from dotenv import dotenv_values


FRONTEND_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = FRONTEND_ROOT.parent
BACKEND_ROOT = REPOSITORY_ROOT / "backend"
COURSE_ID = "95d7389e-cebf-4c83-a1b0-0ed6a7811851"
R2_UNIT_PREFIX = (
    "LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/"
    "basics of pharmacology-chege/"
)

EXPECTED_TOPICS = (
    "Introduction to Pharmacology",
    "Routes of Drug Administration",
    "Pharmacokinetics: Absorption and Distribution",
    "Pharmacokinetics: Metabolism and Elimination",
    "Pharmacodynamics: Principles and Drug Targets",
    "CAT I",
    "Pharmacodynamics: Receptors and Drug Interactions",
    "Variation in Drug Response",
    "Adverse Drug Effects and Drug Interactions",
    "CAT II",
    "Pharmacogenetics",
    "Revision",
    "Final Examinations",
)

EXPECTED_CORE_BOOK_KEYS = {
    "textbooks/pharmacology/kdt-essentials-of-medical-pharmacology-7th-edition.pdf",
    "textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf",
    "textbooks/pharmacology/rang-dales-pharmacology-pdfdrive-.pdf",
    "textbooks/pharmacology/goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf",
}

EXPECTED_LESSON_KEYS = {
    f"{R2_UNIT_PREFIX}Lesson 1.pdf",
    f"{R2_UNIT_PREFIX}Lesson 2 Pharmacokinetics & Drug routes.pdf",
    f"{R2_UNIT_PREFIX}Lesson 3 Absoprtion.pdf",
    f"{R2_UNIT_PREFIX}Lesson 4 Drug Distribution.pdf",
    f"{R2_UNIT_PREFIX}Lesson 5 Pharmacodynamics (Drug Targets).pdf",
    f"{R2_UNIT_PREFIX}Lesson 6 Pharmacodynamics (signal transduction).pdf",
    f"{R2_UNIT_PREFIX}Lesson 7 Variation in Pharmaco-kinetic & -dybamics.pdf",
    f"{R2_UNIT_PREFIX}Lesson 8 Pharmacogenetics.pdf",
    f"{R2_UNIT_PREFIX}Lesson 9 ADRs & Drug-Drug Interactions.pdf",
}


def frontend_file(path: str) -> str:
    return (FRONTEND_ROOT / path).read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def readonly_database():
    dsn = os.environ.get("DATABASE_URL") or dotenv_values(
        BACKEND_ROOT / ".env"
    ).get("DATABASE_URL")
    if not dsn:
        pytest.skip("DATABASE_URL is not configured")

    try:
        connection = psycopg2.connect(
            dsn,
            options="-c default_transaction_read_only=on",
        )
    except psycopg2.OperationalError as error:
        pytest.skip(f"The configured database is unavailable: {error}")

    try:
        yield connection
    finally:
        connection.close()


def test_ppb311_topics_and_r2_materials_are_attached_to_pharmacology(
    readonly_database,
):
    with readonly_database.cursor() as cursor:
        cursor.execute("SELECT current_database()")
        assert cursor.fetchone()[0] == "medtrack"

        cursor.execute(
            "SELECT id, title FROM courses WHERE id = %s",
            (COURSE_ID,),
        )
        course = cursor.fetchone()
        assert course is not None
        assert course[1] == "Pharmacology"

        cursor.execute(
            """
            SELECT id, title, name, "order", slug
            FROM units
            WHERE course_id = %s AND slug = 'ppb-311'
            """,
            (COURSE_ID,),
        )
        unit = cursor.fetchone()
        assert unit is not None, "PPB 311 unit is missing from Pharmacology"
        unit_id, title, name, order, _slug = unit
        assert title == "Basic Principles in Pharmacology"
        assert name == "PPB 311"
        assert order == 1, "PPB 311 should be the first unit in Pharmacology"

        cursor.execute(
            """
            SELECT id, name, "order"
            FROM topics
            WHERE unit_id = %s
            ORDER BY "order"
            """,
            (unit_id,),
        )
        topics = cursor.fetchall()
        assert tuple(topic[1] for topic in topics) == EXPECTED_TOPICS
        topic_ids = {topic[1]: topic[0] for topic in topics}

        cursor.execute(
            """
            SELECT m.title, m.topic_id, f.key
            FROM materials AS m
            JOIN files AS f ON f.id = m.file_id
            WHERE m.unit_id = %s
            """,
            (unit_id,),
        )
        materials = cursor.fetchall()

    keys = {key for _title, _topic_id, key in materials if key}
    assert EXPECTED_CORE_BOOK_KEYS <= keys, "One or more outline textbooks are not linked"
    assert EXPECTED_LESSON_KEYS <= keys, "One or more PPB 311 lesson PDFs are not linked"
    assert f"{R2_UNIT_PREFIX}PPB 311 Course Outline.pdf" in keys

    material_topics = {topic_id for _title, topic_id, _key in materials if topic_id}
    topics_with_lessons = (
        "Introduction to Pharmacology",
        "Routes of Drug Administration",
        "Pharmacokinetics: Absorption and Distribution",
        "Pharmacokinetics: Metabolism and Elimination",
        "Pharmacodynamics: Principles and Drug Targets",
        "Pharmacodynamics: Receptors and Drug Interactions",
        "Variation in Drug Response",
        "Adverse Drug Effects and Drug Interactions",
        "Pharmacogenetics",
    )
    assert {topic_ids[name] for name in topics_with_lessons} <= material_topics


def test_course_and_unit_navigation_preserve_topic_ids_and_open_materials():
    navigation = frontend_file("src/features/courses/hooks/useCourseNavigation.ts")
    unit_layout = frontend_file("src/features/courses/components/units/UnitLayout.tsx")
    course_sidebar = frontend_file("src/features/courses/components/CourseSidebar.tsx")
    topic_service = frontend_file("src/features/courses/services/topicService.ts")
    admin_page = frontend_file("src/app/admin/content/page.tsx")

    assert "parentUnitId || String(targetChapter.id)" in navigation
    assert "parentUnitId && topicIdFromUrl" in navigation
    assert "useCourseNavigation(unitData?.chapters || [], unitId)" in unit_layout
    assert "/courses/${courseId}/units/${unitId}/topics/${topicId}" in topic_service
    assert "openMaterial(String(material.id))" in course_sidebar
    assert "getCourseById(courseId)" in admin_page
    assert "onExpandCourse={loadCourseDetails}" in admin_page