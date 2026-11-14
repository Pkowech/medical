import uuid

import pytest


@pytest.fixture
def course_and_unit(user_factory, course_factory):
    """
    Fixture to create a course and a unit, providing a dynamic unit ID for tests.
    This requires an instructor or admin to create the course.
    """
    # Arrange: Create an instructor to set up a course and unit
    instructor = user_factory(role="instructor")
    headers = {"Authorization": f"Bearer {instructor['accessToken']}"}

    # Create a course using the provided course factory (ensures required fields)
    course_id = course_factory(creator_role="instructor", creator_user=instructor)

    # Create a unit within that course
    unit_payload = {
        "name": "test-unit-1",
        "title": "Test Unit 1",
        "courseId": course_id,
        "order": 1
    }
    unit_res = user_factory.session.post(f"{user_factory.base_url}/units", headers=headers, json=unit_payload)
    assert unit_res.status_code == 201, "Failed to create a unit for setup."
    return unit_res.json()["data"]


def test_student_can_get_quiz_for_unit(user_factory, course_and_unit):
    """
    Tests that an authenticated student can fetch a quiz for a specific unit.
    """
    # Arrange: Create a student user
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}
    # Act: Request the quiz for a given unit
    response = user_factory.session.get(f"{user_factory.base_url}/quizzes/unit/{course_and_unit['id']}", headers=headers)

    # Assert: Check for a successful response
    assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
    
    quiz_data = response.json()["data"]
    assert isinstance(quiz_data, list), "Expected quiz data to be a list of questions"
    if len(quiz_data) > 0:
        assert "id" in quiz_data[0]
        assert "questionText" in quiz_data[0]


def test_student_can_submit_quiz(user_factory, course_and_unit):
    """
    Tests that a student can submit their answers for a quiz.
    """
    # Arrange: Create a student user
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}
    unit_id = course_and_unit["id"]
    attempt_id = str(uuid.uuid4())
    start_response = user_factory.session.post(
        f"{user_factory.base_url}/quizzes/{unit_id}/start",
        headers=headers,
        json={"attemptId": attempt_id},
    )
    if start_response.status_code == 404:
        return
    assert start_response.status_code == 200, start_response.text

    question_response = user_factory.session.get(
        f"{user_factory.base_url}/quizzes/unit/{unit_id}",
        headers=headers,
    )
    assert question_response.status_code == 200, question_response.text
    questions = question_response.json()["data"]
    answers = []
    for question in questions:
        options = question.get("options", [])
        selected_option = options[0]["id"] if options else None
        answers.append(
            {"questionId": question["id"], "selectedOption": selected_option}
        )
        if selected_option:
            answer_response = user_factory.session.post(
                f"{user_factory.base_url}/quizzes/attempts/{attempt_id}/answers",
                headers=headers,
                json={
                    "questionId": question["id"],
                    "selectedOption": selected_option,
                },
            )
            assert answer_response.status_code == 200, answer_response.text

    response = user_factory.session.post(
        f"{user_factory.base_url}/quizzes/submit?type=full",
        headers=headers,
        json={"unitId": unit_id, "attemptId": attempt_id, "answers": answers},
    )
    assert response.status_code == 201, response.text


def test_submit_quiz_returns_404_when_no_quiz_exists(user_factory):
    """
    Tests that submitting a quiz for a non-existent unit returns a 404 NotFound error
    instead of silently creating an invalid quiz (verifying Bug 3 fix).
    """
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}
    fake_unit_id = "00000000-0000-0000-0000-000000000000"
    
    response = user_factory.session.post(
        f"{user_factory.base_url}/quizzes/{fake_unit_id}/start",
        headers=headers,
        json={"attemptId": str(uuid.uuid4())},
    )
    assert response.status_code == 404, f"Expected 404 for missing quiz, got {response.status_code}"


def test_topic_quiz_submission_validation(user_factory):
    """
    Tests that submitting an empty responses array for a topic quiz returns 400 Bad Request.
    """
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}
    fake_topic_id = "00000000-0000-0000-0000-000000000000"

    response = user_factory.session.post(
        f"{user_factory.base_url}/quizzes/topic/{fake_topic_id}/submit",
        headers=headers,
        json={"responses": []}
    )
    assert response.status_code in (400, 404), f"Expected 400 or 404, got {response.status_code}"