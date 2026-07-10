import pytest
import requests
from faker import Faker
import random
import uuid
import grpc
import sys
import os
import asyncio as _asyncio
import anyio as _anyio

# Compatibility shim: some tests call `asyncio.gather` directly. When tests
# run under the Trio anyio backend there may be no asyncio event loop in the
# current thread, which makes `asyncio.gather` raise. Replace
# `asyncio.gather` with a small wrapper that falls back to `anyio` task
# groups when no asyncio loop is available. If an asyncio loop exists we
# delegate to the original implementation.
_orig_asyncio_gather = _asyncio.gather

async def _gather_compat(*aws, return_exceptions=False):
    try:
        _asyncio.get_event_loop()
        return await _orig_asyncio_gather(*aws, return_exceptions=return_exceptions)
    except RuntimeError:
        results = [None] * len(aws)
        exceptions = [None] * len(aws)
        async with _anyio.create_task_group() as tg:
            for i, aw in enumerate(aws):
                async def _run(i=i, aw=aw):
                    try:
                        results[i] = await aw
                    except Exception as e:
                        exceptions[i] = e
                        if not return_exceptions:
                            raise
                tg.start_soon(_run)

        if return_exceptions:
            return [exceptions[i] if exceptions[i] is not None else results[i] for i in range(len(aws))]
        return results

# Install shim
_asyncio.gather = _gather_compat

# --- Test Configuration ---
# Base URL of the running backend application
BASE_URL = "http://localhost:3002/v1"
ANALYTICS_BASE_URL = BASE_URL  # Use same backend URL for analytics endpoints
GRPC_ANALYTICS_HOST = "localhost"
GRPC_ANALYTICS_PORT = 50051

# Initialize Faker to generate random test data
fake = Faker()


@pytest.fixture(scope="session")
def base_url():
    """Fixture to provide the base URL to tests."""
    return BASE_URL

@pytest.fixture(scope="session")
def analytics_base_url():
    """Fixture to provide the analytics service base URL to tests."""
    return ANALYTICS_BASE_URL

@pytest.fixture(scope="session")
def session():
    """Create a requests session for the entire test session."""
    return requests.Session()


@pytest.fixture(scope="function")  # Changed from session to function scope
def user_factory(session, base_url):
    """
    A factory fixture to create and register a user with a specific role.
    Returns the authenticated user's data, including tokens.

    The session and base_url are attached to the factory function for convenience.
    """
    created_users = []

    def _create_user(role: str):
        # Add unique suffix to ensure uniqueness across test runs
        unique_suffix = str(uuid.uuid4())[:8]
        
        user_credentials = {
            "email": f"{fake.user_name()}_{unique_suffix}@{fake.domain_name()}",
            "username": f"{fake.user_name()}_{unique_suffix}",
            "password": "strongPassword123!",
            "confirmPassword": "strongPassword123!",
            "firstName": fake.first_name(),
            "lastName": fake.last_name(),
            "role": role,
            "acceptTerms": True,
        }

        # Register the user
        response = session.post(f"{base_url}/auth/register", json=user_credentials)
        assert response.status_code == 201, f"Failed to register user with role {role}. Response: {response.text}"
        
        response_data = response.json()["data"]
        created_users.append(response_data)
        return response_data

    # Attach session and base_url to the factory for easy access in tests
    _create_user.session = session
    _create_user.base_url = base_url
    
    yield _create_user

    # --- Teardown ---
    # Clean up created users if possible
    # Note: This requires admin access to delete users
    # If you have an admin endpoint for cleanup, implement it here


@pytest.fixture(scope="function")
def analytics_session(session):
    """
    Create a session for analytics API tests.
    """
    return session


@pytest.fixture(scope="function")  # Changed from session to function scope
def admin_user(user_factory):
    """
    Function-scoped fixture to create and return an admin user.
    Creates a fresh admin user for each test that needs one.
    """
    return user_factory(role="admin")


@pytest.fixture(scope="function")
def course_factory(session, base_url, user_factory):
    """
    A factory fixture to create a course for testing.
    Requires an instructor or admin user to create the course.
    Provides the created course ID and handles teardown to delete it.
    """
    created_course_ids = []
    admin_user = None

    def _create_course(creator_role: str = "instructor", creator_user=None):
        nonlocal admin_user
        
        # If creator_user is not provided, create one using user_factory
        if creator_user is None:
            creator_user = user_factory(role=creator_role)
        
        creator_headers = {"Authorization": f"Bearer {creator_user['accessToken']}"}
        
        course_payload = {
            "name": fake.sentence(nb_words=3),
            "title": fake.sentence(nb_words=5),
            "description": fake.paragraph(),
            "code": fake.unique.word().upper() + str(fake.unique.random_int(min=100, max=999)),
            "price": fake.random_int(min=0, max=500),
        }
        response = session.post(f"{base_url}/courses", headers=creator_headers, json=course_payload)
        assert response.status_code == 201, f"Failed to create course. Response: {response.text}"
        course_id = response.json()["data"]["id"]
        created_course_ids.append(course_id)
        
        # Store admin user for cleanup if not already set
        if admin_user is None and creator_role == "admin":
            admin_user = creator_user
        
        return course_id

    yield _create_course

    # --- Teardown: Delete created courses using an admin user ---
    if created_course_ids:
        # Create admin user for cleanup if we don't have one
        if admin_user is None:
            admin_user = user_factory(role="admin")
        
        admin_headers = {"Authorization": f"Bearer {admin_user['accessToken']}"}
        
        for course_id in created_course_ids:
            try:
                response = session.delete(f"{base_url}/courses/{course_id}", headers=admin_headers)
                # Assert that deletion was successful or the course was already gone
                assert response.status_code in [204, 200, 404], f"Failed to delete course {course_id}. Response: {response.text}"
            except Exception as e:
                print(f"Warning: Failed to clean up course {course_id}: {e}")


# --- gRPC Fixtures ---

@pytest.fixture(scope="session")
async def grpc_analytics_channel():
    """
    Create a gRPC channel for analytics service tests.
    This creates a session-scoped channel that persists across tests.
    """
    channel = grpc.aio.secure_channel(
        f"{GRPC_ANALYTICS_HOST}:{GRPC_ANALYTICS_PORT}",
        grpc.ssl_channel_credentials(),
    )
    try:
        yield channel
    finally:
        # Close channel in the active async loop
        try:
            await channel.close()
        except Exception:
            pass


@pytest.fixture(scope="function")
def grpc_analytics_channel_insecure():
    """
    Create an insecure gRPC channel for local testing.
    This is function-scoped to allow fresh connections per test if needed.
    """
    # Use synchronous channel here so tests running under different anyio
    # backends (trio/asyncio) don't fail during channel creation. The
    # test client adapts by running blocking stub calls in a thread.
    channel = grpc.insecure_channel(f"{GRPC_ANALYTICS_HOST}:{GRPC_ANALYTICS_PORT}")
    try:
        yield channel
    finally:
        try:
            channel.close()
        except Exception:
            pass


@pytest.fixture(scope="session")
def grpc_host_port():
    """Provide gRPC host and port configuration."""
    return {
        "host": GRPC_ANALYTICS_HOST,
        "port": GRPC_ANALYTICS_PORT,
        "target": f"{GRPC_ANALYTICS_HOST}:{GRPC_ANALYTICS_PORT}"
    }