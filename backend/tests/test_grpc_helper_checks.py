"""Assertions for the protobuf and gRPC helpers checked by the old scripts."""

import pytest


@pytest.mark.unit
def test_generated_analytics_messages_are_importable():
    pytest.importorskip("google.protobuf")
    import analytics_pb2

    assert hasattr(analytics_pb2, "BatchEventRequest")
    assert hasattr(analytics_pb2, "BatchEventResponse")
    assert hasattr(analytics_pb2, "EventPayload")
    assert hasattr(analytics_pb2, "UpdateBktSkillMetricsRequest")
    assert hasattr(analytics_pb2, "UpdateBktSkillMetricsResponse")


@pytest.mark.unit
def test_generated_grpc_stub_exposes_metrics_refresh():
    grpc = pytest.importorskip("grpc")
    try:
        import analytics_pb2_grpc
    except (ImportError, RuntimeError) as error:
        pytest.skip(f"Generated gRPC stub is unavailable: {error}")

    class StubChannel:
        def unary_unary(self, method, **kwargs):
            return method

    stub = analytics_pb2_grpc.AnalyticsServiceStub(StubChannel())
    assert stub.UpdateBktSkillMetrics == "/analytics.AnalyticsService/UpdateBktSkillMetrics"
    assert grpc.__version__


@pytest.mark.unit
def test_grpc_utility_loader_binds_generated_stubs():
    pytest.importorskip("grpc")
    import grpc_utils

    grpc_utils._load_stubs()
    assert grpc_utils.GRPC_STUBS_AVAILABLE
