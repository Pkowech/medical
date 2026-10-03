"""Environment-gated checks formerly run as standalone JavaScript scripts."""

import os
from urllib.parse import urljoin

import pytest


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        pytest.skip(f"{name} is required for this service check")
    return value


def _rust_grpc_target() -> str:
    target = os.getenv("ANALYTICS_GRPC_URL") or os.getenv("RUST_ANALYTICS_GRPC_URL")
    if not target:
        pytest.skip("Set ANALYTICS_GRPC_URL or RUST_ANALYTICS_GRPC_URL to run gRPC checks")
    return target


def _backend_auth_headers() -> dict[str, str]:
    token = _required_env("BACKEND_TEST_AUTH_TOKEN")
    return {"Authorization": f"Bearer {token}"}


def _http_get(url: str):
    requests = pytest.importorskip("requests")
    return requests.get(url, timeout=10)


@pytest.mark.integration
@pytest.mark.grpc
def test_rust_analytics_grpc_metrics_refresh():
    target = _rust_grpc_target()
    api_key = _required_env("RUST_ANALYTICS_API_KEY")
    grpc = pytest.importorskip("grpc")
    try:
        import analytics_pb2
        import analytics_pb2_grpc
    except (ImportError, RuntimeError) as error:
        pytest.skip(f"Generated gRPC helpers are unavailable: {error}")

    channel = grpc.insecure_channel(target)
    try:
        stub = analytics_pb2_grpc.AnalyticsServiceStub(channel)
        response = stub.UpdateBktSkillMetrics(
            analytics_pb2.UpdateBktSkillMetricsRequest(),
            metadata=(("x-api-key", api_key),),
            timeout=10,
        )
        assert response.success
    finally:
        channel.close()


@pytest.mark.integration
@pytest.mark.http
def test_rust_analytics_health_endpoint():
    base_url = _required_env("RUST_ANALYTICS_URL").rstrip("/") + "/"
    response = _http_get(urljoin(base_url, "health"))
    assert response.status_code == 200
    assert response.json().get("status") == "ok"


@pytest.mark.integration
@pytest.mark.http
def test_backend_health_endpoint():
    base_url = _required_env("BACKEND_URL").rstrip("/") + "/"
    response = _http_get(urljoin(base_url, "v1/health"))
    assert response.status_code == 200


@pytest.mark.integration
@pytest.mark.http
def test_backend_api_health_endpoint():
    base_url = _required_env("BACKEND_URL").rstrip("/") + "/"
    response = _http_get(urljoin(base_url, "api/health"))
    assert response.status_code == 200


@pytest.mark.integration
@pytest.mark.http
def test_search_api_returns_a_result_collection():
    requests = pytest.importorskip("requests")
    base_url = _required_env("BACKEND_URL").rstrip("/") + "/"

    response = requests.get(
        urljoin(base_url, "v1/search"),
        params={"query": "cardiology", "page": 1, "limit": 10},
        headers=_backend_auth_headers(),
        timeout=10,
    )
    assert response.status_code == 200
    body = response.json()
    results = body.get("data")
    if isinstance(results, dict):
        results = results.get("data", results.get("results"))
    assert isinstance(results, list)


@pytest.mark.integration
@pytest.mark.http
def test_search_api_supports_pagination():
    requests = pytest.importorskip("requests")
    base_url = _required_env("BACKEND_URL").rstrip("/") + "/"

    response = requests.get(
        urljoin(base_url, "v1/search"),
        params={"query": "medicine", "page": 2, "limit": 5},
        headers=_backend_auth_headers(),
        timeout=10,
    )
    assert response.status_code == 200
    assert response.json().get("data") is not None


@pytest.mark.integration
@pytest.mark.http
@pytest.mark.parametrize("query", ["", "a"])
def test_search_api_rejects_queries_below_the_minimum_length(query):
    requests = pytest.importorskip("requests")
    base_url = _required_env("BACKEND_URL").rstrip("/") + "/"

    response = requests.get(
        urljoin(base_url, "v1/search"),
        params={"query": query},
        headers=_backend_auth_headers(),
        timeout=10,
    )
    assert response.status_code != 200


@pytest.mark.integration
@pytest.mark.http
def test_batch_analytics_endpoint_accepts_configured_test_events():
    requests = pytest.importorskip("requests")
    base_url = _required_env("BACKEND_URL").rstrip("/") + "/"
    token = _required_env("BACKEND_TEST_AUTH_TOKEN")
    user_id = _required_env("BACKEND_TEST_USER_ID")
    skill_id = _required_env("BACKEND_TEST_SKILL_ID")

    from datetime import datetime, timezone
    from uuid import uuid4

    timestamp = datetime.now(timezone.utc).isoformat()
    payload = {
        "events": [
            {
                "user_id": user_id,
                "event_type": "question_answered",
                "skill_id": skill_id,
                "timestamp": timestamp,
                "metadata": {
                    "is_correct": True,
                    "question_id": str(uuid4()),
                    "difficulty": 0.7,
                },
            }
        ]
    }
    response = requests.post(
        urljoin(base_url, "v1/ai-analytics/events/batch"),
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert 200 <= response.status_code < 300, response.text
