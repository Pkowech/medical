import pytest
from faker import Faker
import requests

# Initialize Faker to generate random test data
fake = Faker()


@pytest.fixture(scope="function")
def registered_user(session, base_url):
    """
    Fixture to create a new user for authentication tests.
    This now includes both credentials and the tokens received upon registration.
    """
    user_credentials = {
        "email": fake.email(),
        "username": fake.user_name(),
        "password": "strongPassword123!",
        "confirmPassword": "strongPassword123!",
        "firstName": fake.first_name(),
        "lastName": fake.last_name(),
        "role": "student",
        "acceptTerms": True,
    }
    
    # Register the user
    response = session.post(f"{base_url}/auth/register", json=user_credentials)
    assert response.status_code == 201, f"Failed to register user. Status: {response.status_code}, Response: {response.text}"
    
    response_data = response.json()
    
    # Validate response structure
    assert "data" in response_data, f"Missing 'data' field in registration response: {response_data}"
    
    data = response_data["data"]
    assert "accessToken" in data, f"Missing 'accessToken' in response data: {data}"
    assert "refreshToken" in data, f"Missing 'refreshToken' in response data: {data}"
    assert "user" in data, f"Missing 'user' in response data: {data}"
    
    return {
        "credentials": user_credentials,
        "accessToken": data["accessToken"],
        "refreshToken": data["refreshToken"],
        "user": data["user"],
    }


def test_successful_login(session, base_url, registered_user):
    """
    Tests a successful user login with correct credentials.
    Expects a 200 OK status and new access/refresh tokens.
    """
    # Arrange: Use the credentials of the registered user
    login_credentials = {
        "email": registered_user["credentials"]["email"],
        "password": registered_user["credentials"]["password"],
    }

    print(f"Login credentials: {login_credentials}")
    # Act: Send a POST request to the login endpoint
    response = session.post(f"{base_url}/auth/login", json=login_credentials)
    print(f"Response: {response.text}")

    # Assert: Check for a successful response
    assert response.status_code == 200, f"Expected status code 200, but got {response.status_code}. Response: {response.text}"
    
    response_data = response.json()
    
    # Login is wrapped by interceptor, so check data field
    assert "data" in response_data, f"Missing 'data' field: {response_data}"
    data = response_data["data"]
    
    assert "accessToken" in data, f"accessToken not found in response: {data}"
    assert "refreshToken" in data, f"refreshToken not found in response: {data}"
    assert "user" in data, f"user not found in response: {data}"
    


def test_login_with_incorrect_password(session, base_url, registered_user):
    """
    Tests a login attempt with an incorrect password.
    Expects a 401 Unauthorized status.
    """
    # Arrange: Use the correct email but a wrong password
    login_credentials = {
        "email": registered_user["credentials"]["email"],
        "password": "wrongPassword",
    }

    # Act: Send a POST request to the login endpoint
    response = session.post(f"{base_url}/auth/login", json=login_credentials)

    # Assert: Check for an unauthorized error
    assert response.status_code == 401, f"Expected status code 401, but got {response.status_code}. Response: {response.text}"


def test_logout(session, base_url, registered_user):
    """
    Tests the user logout functionality.
    Expects a 200 OK status.
    """


    logout_data = {"refreshToken": registered_user["refreshToken"]}

    print(f"Access Token: {registered_user['accessToken']}")
    print(f"Refresh Token: {registered_user['refreshToken']}")
    headers = {"Authorization": f"Bearer {registered_user['accessToken']}"}
    response = session.post(f"{base_url}/auth/logout", headers=headers, json=logout_data)
    print(f"Response: {response.text}")

    # Assert: Check for a successful logout response
    assert response.status_code == 200, f"Expected status code 200, but got {response.status_code}. Response: {response.text}"
    
    response_data = response.json()
    
    # The logout endpoint returns data wrapped by interceptor
    assert response_data["success"] is True, f"Expected success to be true, but got {response_data}"
    # Logout returns either empty data or a success message
    assert response_data["data"] is not None, f"Expected data to be present, but got {response_data}"

    # Act Part 2: Attempt to use the invalidated access token
    profile_response = session.get(f"{base_url}/users/profile", headers=headers)

    # Assert Part 2: Check for an unauthorized error
    assert profile_response.status_code == 401, \
        f"Expected 401 after logout, but got {profile_response.status_code}. Token might still be valid."