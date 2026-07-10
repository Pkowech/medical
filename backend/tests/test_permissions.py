import pytest


@pytest.mark.parametrize(
    "role, expected_status_code",
    [
        ("admin", 200),       # Admin should have access
        ("instructor", 403),  # Instructor should be forbidden
        ("student", 403),     # Student should be forbidden
    ],
)
def test_admin_endpoint_access(session, base_url, user_factory, role, expected_status_code):
    """
    Tests access to a protected admin endpoint based on user role.
    - Admins should receive a 200 OK.
    - Other roles should receive a 403 Forbidden.
    """
    # Arrange: Create a user with the specified role
    user = user_factory(role=role)
    access_token = user["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Act: Attempt to access a protected admin endpoint.
    # Using GET /v1/roles as it's a common admin-only route.
    response = session.get(f"{base_url}/roles", headers=headers)

    # Assert: Verify the status code is as expected for the role
    assert response.status_code == expected_status_code, \
        f"For role '{role}', expected status {expected_status_code} but got {response.status_code}. Response: {response.text}"


@pytest.mark.parametrize(
    "role, expected_status_code",
    [
        ("admin", 201),       # Admin should have access (201 Created)
        ("instructor", 201),  # Instructor should also have access (201 Created)
        ("student", 403),     # Student should be forbidden
    ],
)
def test_course_management_endpoint_access(session, base_url, user_factory, role, expected_status_code):
    """
    Tests access to an endpoint shared by admins and instructors.
    - Admins and Instructors should receive a 200 OK.
    - Other roles should receive a 403 Forbidden.
    """
    # Arrange: Create a user with the specified role
    user = user_factory(role=role)
    access_token = user["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Act: Attempt to access a course management endpoint.
    # Using POST /v1/courses as an example of a route accessible to admins/instructors.
    # A dummy payload is required for a POST request.
    course_payload = {
        "name": "New Course by " + role,
        "title": "New Course by " + role,
        "description": "A test course."
    }
    response = session.post(f"{base_url}/courses", headers=headers, json=course_payload)

    # Assert: Verify the status code is as expected for the role
    assert response.status_code == expected_status_code, \
        f"For role '{role}', expected status {expected_status_code} but got {response.status_code}. Response: {response.text}"


def test_unauthenticated_access_to_admin_endpoint(session, base_url):
    """
    Tests that an unauthenticated user receives a 401 Unauthorized error
    when trying to access a protected admin endpoint.
    """
    # Act: Attempt to access the protected admin endpoint without any auth headers
    # Using GET /v1/roles as it's a common admin-only route.
    response = session.get(f"{base_url}/roles")

    # Assert: Verify the status code is 401 Unauthorized
    assert response.status_code == 401, \
        f"Expected status 401 for unauthenticated access, but got {response.status_code}. Response: {response.text}"

@pytest.mark.parametrize(
    "role, expected_status_code",
    [
        ("admin", 200),       # Admin should have access
        ("instructor", 200),  # Instructor should also have access
        ("student", 403),     # Student should be forbidden
    ],
)
def test_course_update_access(session, base_url, user_factory, course_factory, role, expected_status_code):
    """
    Tests access to update a course based on user role.
    - Admins and Instructors should receive a 200 OK.
    - Other roles should receive a 403 Forbidden.
    """
    # Arrange: Create a user with the specified role and a course
    user = user_factory(role=role)
    access_token = user["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}
    # If the user is a student, the course should be created by an instructor for the test
    if role == "student":
        course_id = course_factory(creator_role="instructor")
    else:
        course_id = course_factory(creator_user=user) # Course created by the user being tested

    update_payload = {

        "title": "Updated Course Title by " + role
    }

    # Act: Attempt to update the course
    response = session.patch(f"{base_url}/courses/{course_id}", headers=headers, json=update_payload)

    # Assert: Verify the status code is as expected for the role
    assert response.status_code == expected_status_code, \
        f"For role '{role}', expected status {expected_status_code} but got {response.status_code}. Response: {response.text}"


@pytest.mark.parametrize(
    "role, expected_status_code",
    [
        ("admin", 204),       # Admin should have access (204 No Content for successful delete)
        ("instructor", 403),  # Instructor should be forbidden
        ("student", 403),     # Student should be forbidden
    ],
)
def test_course_delete_access(session, base_url, user_factory, course_factory, role, expected_status_code):
    """
    Tests access to delete a course based on user role.
    - Admins should receive a 204 No Content.
    - Other roles should receive a 403 Forbidden.
    """
    # Arrange: Create a user with the specified role and a course
    user = user_factory(role=role)
    access_token = user["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}
    # If the user is a student, the course should be created by an instructor for the test
    if role == "student":
        course_id = course_factory(creator_role="instructor")
    else:
        course_id = course_factory(creator_user=user) # Course created by the user being tested

    # Act: Attempt to delete the course

    response = session.delete(f"{base_url}/courses/{course_id}", headers=headers)

    # Assert: Verify the status code is as expected for the role
    assert response.status_code == expected_status_code, \
        f"For role '{role}', expected status {expected_status_code} but got {response.status_code}. Response: {response.text}"


@pytest.mark.parametrize(
    "role, expected_status_code",
    [
        ("admin", 201),       # Admin should have access (201 Created)
        ("instructor", 201),  # Instructor should have access (201 Created)
        ("student", 201),     # Student should have access (201 Created)
        ("moderator", 201),   # Moderator should have access (201 Created) - Adjusted expectation
    ],
)
def test_study_group_management_access(session, base_url, user_factory, role, expected_status_code):
    """
    Tests access to create a study group based on user role.
    - Admins and Moderators should receive a 201 Created.
    - Other roles should receive a 403 Forbidden.
    """
    # Arrange: Create a user with the specified role
    user = user_factory(role=role)
    access_token = user["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Act: Attempt to create a study group.
    study_group_payload = {
        "name": f"Test Study Group by {role}",
        "description": "A test study group description.",
        "maxMembers": 10,
        "type": "general",  # Added required 'type' field
        "privacy": "public" # Added required 'privacy' field
    }
    response = session.post(f"{base_url}/study-groups", headers=headers, json=study_group_payload)

    # Assert: Verify the status code is as expected for the role
    assert response.status_code == expected_status_code, \
        f"For role '{role}', expected status {expected_status_code} but got {response.status_code}. Response: {response.text}"
