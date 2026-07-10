import pytest
from faker import Faker

fake = Faker()


def extract_data(response_json):
    """
    Helper function to extract data from various response formats.
    Handles: ApiResponseDto wrapping, direct data, or nested structures.
    """
    if not response_json:
        return {}
    
    # If the response is an ApiResponseDto, extract its 'data' field
    if "success" in response_json and "data" in response_json:
        # If data is null, treat as empty
        if response_json["data"] is None:
            return {}
        return response_json["data"]
    
    # If response has 'user' key at top level, use that
    if "user" in response_json:
        return response_json["user"]
    
    # Otherwise return the response itself
    return response_json


def test_get_own_profile(user_factory):
    """
    Tests that any authenticated user can fetch their own profile.
    """
    # Arrange: Create a standard user and get their token
    user = user_factory(role="student")
    access_token = user["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Act: Make a request to the personal profile endpoint
    response = user_factory.session.get(f"{user_factory.base_url}/users/profile", headers=headers)

    # Assert: Check for a successful response and correct user data
    assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
    
    response_json = response.json()
    print(f"DEBUG - Full response: {response_json}")  # Debug output
    
    profile_data = extract_data(response_json)
    
    # Check if response is empty (if API returns 200 with empty body)
    assert profile_data, f"API returned 200 OK but response body was empty. Full response: {response_json}"
    
    user_id = user["user"]["id"]
    user_email = user["user"]["email"]
    
    # Robust extraction of ID and email
    actual_id = profile_data.get("id")
    if not actual_id: # Try _id if id is not found
        actual_id = profile_data.get("_id")
    if not actual_id and "user" in profile_data and isinstance(profile_data.get("user"), dict): # Check nested 'user'
        actual_id = profile_data["user"].get("id")
    
    actual_email = profile_data.get("email")
    if not actual_email and "user" in profile_data and isinstance(profile_data.get("user"), dict): # Check nested 'user'
        actual_email = profile_data["user"].get("email")
    
    assert actual_id == user_id, \
        f"User ID mismatch. Expected {user_id}, got {actual_id}. Full response: {response_json}"
    assert actual_email == user_email, \
        f"Email mismatch. Expected {user_email}, got {actual_email}. Full response: {response_json}"


def test_admin_can_list_all_users(user_factory):
    """
    Tests that a user with the 'admin' role can list all users.
    """
    # Arrange: Create an admin user
    admin_user = user_factory(role="admin")
    headers = {"Authorization": f"Bearer {admin_user['accessToken']}"}

    # Act: Request the list of all users
    response = user_factory.session.get(f"{user_factory.base_url}/users", headers=headers)

    # Assert: Check for a successful response
    assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
    
    response_json = response.json()
    print(f"DEBUG - Full response: {response_json}")  # Debug output
    
    data = extract_data(response_json)
    
    # Check if response is empty
    assert data, f"API returned 200 OK but response body was empty. Full response: {response_json}"
    
    users_list = None
    if isinstance(data, list):
        users_list = data
    elif isinstance(data, dict):
        # Paginated response - check for various possible keys
        possible_keys = ["users", "items", "results"] # Updated possible_keys
        for key in possible_keys:
            if key in data and isinstance(data.get(key), list):
                users_list = data[key]
                break
    
    assert users_list is not None and isinstance(users_list, list), \
        f"Expected a list of users or a dictionary containing 'users', 'items', or 'results' key with a list. Got: {type(data)} with keys {list(data.keys()) if isinstance(data, dict) else ''}. Full response: {response_json}"


def test_student_cannot_list_all_users(user_factory):
    """
    Tests that a non-admin user cannot list all users.
    """
    # Arrange: Create a student user
    student_user = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student_user['accessToken']}"}

    # Act: Attempt to request the list of all users
    response = user_factory.session.get(f"{user_factory.base_url}/users", headers=headers)

    # Assert: Check for a 403 Forbidden error
    assert response.status_code == 403, f"Expected 403, got {response.status_code}. Response: {response.text}"


def test_admin_can_get_user_by_id(user_factory):
    """
    Tests that an admin can fetch any specific user by their ID.
    """
    # Arrange: Create an admin and a target student user
    admin_user = user_factory(role="admin")
    student_user = user_factory(role="student")
    student_id = student_user["user"]["id"]
    headers = {"Authorization": f"Bearer {admin_user['accessToken']}"}

    # Act: Admin requests the student's data by ID
    response = user_factory.session.get(f"{user_factory.base_url}/users/{student_id}", headers=headers)

    # Assert: Check for a successful response and correct data
    assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
    
    response_json = response.json()
    print(f"DEBUG - Full response: {response_json}")  # Debug output
    
    data = extract_data(response_json)
    
    # Check if response is empty
    assert data, f"API returned 200 OK but response body was empty. Full response: {response_json}"
    
    actual_id = data.get("id")
    if not actual_id: # Try _id if id is not found
        actual_id = data.get("_id")
    if not actual_id and "user" in data and isinstance(data.get("user"), dict): # Check nested 'user'
        actual_id = data["user"].get("id")
        
    assert actual_id == student_id, \
        f"User ID mismatch. Expected {student_id}, got {actual_id}. Full response: {response_json}"


def test_student_cannot_get_user_by_id(user_factory):
    """
    Tests that a student cannot fetch another user's data by ID.
    """
    # Arrange: Create two student users
    student_1 = user_factory(role="student")
    student_2 = user_factory(role="student")
    student_2_id = student_2["user"]["id"]
    headers = {"Authorization": f"Bearer {student_1['accessToken']}"}

    # Act: Student 1 attempts to request Student 2's data
    response = user_factory.session.get(f"{user_factory.base_url}/users/{student_2_id}", headers=headers)

    # Assert: Check for a 403 Forbidden error
    assert response.status_code == 403, f"Expected 403, got {response.status_code}. Response: {response.text}"


def test_unauthorized_access_to_profile(user_factory):
    """
    Tests that an unauthenticated user cannot access /users/profile.
    """
    # Act: Make a request without authentication headers
    response = user_factory.session.get(f"{user_factory.base_url}/users/profile")

    # Assert: Check for a 401 Unauthorized error
    assert response.status_code == 401, f"Expected 401, got {response.status_code}. Response: {response.text}"


def test_user_can_update_own_profile(user_factory):
    """
    Tests that an authenticated user can update their own profile.
    """
    # Arrange: Create a user
    user = user_factory(role="student")
    user_id = user["user"]["id"]
    headers = {"Authorization": f"Bearer {user['accessToken']}"}
    
    updated_data = {
        "firstName": fake.first_name(),
        "lastName": fake.last_name(),
        "bio": fake.text(max_nb_chars=200)
    }

    # Act: Update the user's profile
    response = user_factory.session.patch(
        f"{user_factory.base_url}/users/{user_id}", 
        headers=headers, 
        json=updated_data
    )

    # Assert: Check for successful update
    assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
    
    response_json = response.json()
    print(f"DEBUG - Full response: {response_json}")  # Debug output
    
    data = extract_data(response_json)
    
    # Check if response is empty
    assert data, f"API returned 200 OK but response body was empty. Full response: {response_json}"
    
    # Robust extraction of firstName and lastName
    actual_first_name = data.get("firstName")
    if not actual_first_name:
        actual_first_name = data.get("first_name")
    if not actual_first_name and "user" in data and isinstance(data.get("user"), dict):
        actual_first_name = data["user"].get("firstName")
        if not actual_first_name:
            actual_first_name = data["user"].get("first_name")

    actual_last_name = data.get("lastName")
    if not actual_last_name:
        actual_last_name = data.get("last_name")
    if not actual_last_name and "user" in data and isinstance(data.get("user"), dict):
        actual_last_name = data["user"].get("lastName")
        if not actual_last_name:
            actual_last_name = data["user"].get("last_name")

    assert actual_first_name == updated_data["firstName"], \
        f"First name mismatch. Expected {updated_data['firstName']}, got {actual_first_name}. Full response: {response_json}"
    assert actual_last_name == updated_data["lastName"], \
        f"Last name mismatch. Expected {updated_data['lastName']}, got {actual_last_name}. Full response: {response_json}"


def test_user_cannot_update_another_users_profile(user_factory):
    """
    Tests that a non-admin user cannot update another user's profile.
    """
    # Arrange: Create two student users
    student_1 = user_factory(role="student")
    student_2 = user_factory(role="student")
    student_2_id = student_2["user"]["id"]
    headers = {"Authorization": f"Bearer {student_1['accessToken']}"}
    
    updated_data = {
        "firstName": fake.first_name()
    }

    # Act: Student 1 attempts to update Student 2's profile
    response = user_factory.session.patch(
        f"{user_factory.base_url}/users/{student_2_id}", 
        headers=headers, 
        json=updated_data
    )

    # Assert: Check for a 403 Forbidden error
    assert response.status_code == 403, f"Expected 403, got {response.status_code}. Response: {response.text}"


def test_admin_can_update_any_user_profile(user_factory):
    """
    Tests that an admin can update any user's profile.
    """
    # Arrange: Create an admin and a student user
    admin_user = user_factory(role="admin")
    student_user = user_factory(role="student")
    student_id = student_user["user"]["id"]
    headers = {"Authorization": f"Bearer {admin_user['accessToken']}"}
    
    updated_data = {
        "firstName": fake.first_name(),
        "lastName": fake.last_name()
    }

    # Act: Admin updates the student's profile
    response = user_factory.session.patch(
        f"{user_factory.base_url}/users/{student_id}", 
        headers=headers, 
        json=updated_data
    )

    # Assert: Check for successful update
    assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
    
    response_json = response.json()
    print(f"DEBUG - Full response: {response_json}")  # Debug output
    
    data = extract_data(response_json)
    
    # Check if response is empty
    assert data, f"API returned 200 OK but response body was empty. Full response: {response_json}"
    
    # Robust extraction of firstName and lastName
    actual_first_name = data.get("firstName")
    if not actual_first_name:
        actual_first_name = data.get("first_name")
    if not actual_first_name and "user" in data and isinstance(data.get("user"), dict):
        actual_first_name = data["user"].get("firstName")
        if not actual_first_name:
            actual_first_name = data["user"].get("first_name")

    actual_last_name = data.get("lastName")
    if not actual_last_name:
        actual_last_name = data.get("last_name")
    if not actual_last_name and "user" in data and isinstance(data.get("user"), dict):
        actual_last_name = data["user"].get("lastName")
        if not actual_last_name:
            actual_last_name = data["user"].get("last_name")

    assert actual_first_name == updated_data["firstName"], \
        f"First name mismatch. Expected {updated_data['firstName']}, got {actual_first_name}. Full response: {response_json}"
    assert actual_last_name == updated_data["lastName"], \
        f"Last name mismatch. Expected {updated_data['lastName']}, got {actual_last_name}. Full response: {response_json}"


def test_admin_can_delete_user(user_factory):
    """
    Tests that an admin can delete a user.
    """
    # Arrange: Create an admin and a student user
    admin_user = user_factory(role="admin")
    student_user = user_factory(role="student")
    student_id = student_user["user"]["id"]
    headers = {"Authorization": f"Bearer {admin_user['accessToken']}"}

    # Act: Admin deletes the student
    response = user_factory.session.delete(
        f"{user_factory.base_url}/users/{student_id}", 
        headers=headers
    )

    # Assert: Check for successful deletion (200 or 204)
    assert response.status_code in [200, 204], f"Expected 200 or 204, got {response.status_code}. Response: {response.text}"


def test_student_cannot_delete_user(user_factory):
    """
    Tests that a non-admin user cannot delete a user.
    """
    # Arrange: Create two student users
    student_1 = user_factory(role="student")
    student_2 = user_factory(role="student")
    student_2_id = student_2["user"]["id"]
    headers = {"Authorization": f"Bearer {student_1['accessToken']}"}

    # Act: Student 1 attempts to delete Student 2
    response = user_factory.session.delete(
        f"{user_factory.base_url}/users/{student_2_id}", 
        headers=headers
    )

    # Assert: Check for a 403 Forbidden error
    assert response.status_code == 403, f"Expected 403, got {response.status_code}. Response: {response.text}"