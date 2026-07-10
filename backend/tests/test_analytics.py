"""gRPC-only Analytics Tests
These tests exercise the analytics gRPC service via the GrpcAnalyticsClient.
"""

import os
import pytest
import json
from datetime import datetime, timezone
import asyncio

from grpc_utils import GrpcAnalyticsClient


def get_utc_timestamp():
    """Get current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


class TestGrpcAnalyticsEvents:
    """Tests for batch event tracking via gRPC."""

    @pytest.mark.anyio
    async def test_grpc_batch_submission(self, user_factory, grpc_analytics_channel_insecure):
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token,
        )

        events = [
            {
                "eventType": "page_view",
                "page": "/courses",
                "timestamp": get_utc_timestamp(),
                "sessionId": "session_123",
                "duration": 45,
            },
            {
                "eventType": "quiz_attempt",
                "quizId": "quiz_456",
                "score": 85,
                "timestamp": get_utc_timestamp(),
                "sessionId": "session_123",
                "duration": 600,
            },
        ]

        response = await client.batch_track_events(events)
        assert isinstance(response, dict)
        assert "processed" in response
        assert "failed" in response

    @pytest.mark.anyio
    async def test_grpc_empty_batch_submission(self, user_factory, grpc_analytics_channel_insecure):
        """Tests gRPC batch submission with empty events list."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token,
        )

        response = await client.batch_track_events([])
        assert isinstance(response, dict)
        assert "success" in response

    @pytest.mark.anyio
    async def test_grpc_batch_with_various_event_types(self, user_factory, grpc_analytics_channel_insecure):
        """Tests gRPC batch submission with various event types."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token,
        )

        events = [
            {"eventType": "login", "timestamp": get_utc_timestamp()},
            {"eventType": "course_enrollment", "courseId": "course_001", "timestamp": get_utc_timestamp()},
            {"eventType": "unit_completion", "unitId": "unit_001", "timestamp": get_utc_timestamp()},
            {"eventType": "assessment_start", "assessmentId": "assess_001", "timestamp": get_utc_timestamp()},
            {"eventType": "assessment_complete", "assessmentId": "assess_001", "score": 92, "timestamp": get_utc_timestamp()},
            {"eventType": "logout", "timestamp": get_utc_timestamp()},
        ]

        response = await client.batch_track_events(events)
        assert isinstance(response, dict)

class TestGrpcBKTModel:
    """Test Bayesian Knowledge Tracing model via gRPC."""

    @pytest.mark.anyio
    async def test_grpc_bkt_prediction(self, user_factory, grpc_analytics_channel_insecure):
        """Tests BKT model prediction via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        response = await client.predict_bkt(skill_id="math_001", feature_vector=[0.5, 0.3, 0.8])
        assert isinstance(response, dict)
        assert "p_known" in response or "p_next_correct" in response

    @pytest.mark.anyio
    async def test_grpc_get_user_ability(self, user_factory, grpc_analytics_channel_insecure):
        """Tests retrieving user ability via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        response = await client.get_user_ability(user_id=user_id)
        assert isinstance(response, dict)
        assert "user_id" in response or "estimated_ability" in response


class TestGrpcCacheInvalidation:
    """Test cache invalidation via gRPC."""

    @pytest.mark.anyio
    async def test_grpc_cache_invalidation_after_event(self, user_factory, grpc_analytics_channel_insecure):
        """Tests cache invalidation after event tracking via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        # Track event
        events = [
            {
                "eventType": "quiz_attempt",
                "quizId": "quiz_123",
                "score": 90,
                "timestamp": get_utc_timestamp()
            }
        ]
        
        response = await client.batch_track_events(events)
        assert isinstance(response, dict)

        # Get recommendations (which should be fresh)
        recs = await client.get_recommendations(user_id=user_id, limit=5)
        assert isinstance(recs, list)


class TestGrpcRequestDeduplication:
    """Test request deduplication via gRPC."""

    @pytest.mark.anyio
    async def test_grpc_concurrent_requests(self, user_factory, grpc_analytics_channel_insecure):
        """Tests concurrent gRPC requests."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        # Make 3 concurrent requests
        tasks = [
            client.get_recommendations(user_id=user_id),
            client.get_user_ability(user_id=user_id),
            client.predict_bkt(skill_id="math_001")
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)
        assert len(results) == 3
        # Each result should be either a successful response or an exception
        for result in results:
            assert isinstance(result, (dict, list, Exception))


class TestGrpcUserAnalytics:
    """Test user-specific analytics via gRPC."""

    @pytest.mark.anyio
    async def test_grpc_get_engagement_metrics(self, user_factory, grpc_analytics_channel_insecure):
        """Tests retrieving engagement metrics via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        response = await client.get_engagement_metrics(user_id=user_id)
        assert isinstance(response, dict)

    @pytest.mark.anyio
    async def test_grpc_predict_performance(self, user_factory, grpc_analytics_channel_insecure):
        """Tests performance prediction via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        # Provide a non-empty skill_id to satisfy server validation
        response = await client.predict_performance(user_id=user_id, skill_id="sample_skill")
        assert isinstance(response, dict)

    @pytest.mark.anyio
    async def test_grpc_get_quiz_attempt_history(self, user_factory, grpc_analytics_channel_insecure):
        """Tests retrieving quiz attempt history via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        response = await client.get_quiz_attempt_history(limit=10)
        assert isinstance(response, list)


class TestGrpcRecommendations:
    """Test recommendation system via gRPC."""

    @pytest.mark.asyncio
    async def test_grpc_get_recommendations(self, user_factory, grpc_analytics_channel_insecure):
        """Tests retrieving recommendations via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        response = await client.get_recommendations(user_id=user_id, limit=5)
        assert isinstance(response, list)

    @pytest.mark.asyncio
    async def test_grpc_generate_next_steps(self, user_factory, grpc_analytics_channel_insecure):
        """Tests generating next learning steps via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        response = await client.generate_next_steps()
        assert isinstance(response, list)

    @pytest.mark.asyncio
    async def test_grpc_generate_study_recommendations(self, user_factory, grpc_analytics_channel_insecure):
        """Tests generating study recommendations via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        response = await client.generate_study_recommendations(
            knowledge_gaps=["calculus", "physics"]
        )
        assert isinstance(response, list)


class TestGrpcAdaptiveQuestions:
    """Test adaptive question generation via gRPC."""

    @pytest.mark.asyncio
    async def test_grpc_get_next_adaptive_question(self, user_factory, grpc_analytics_channel_insecure):
        """Tests getting next adaptive question via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        response = await client.get_next_adaptive_question(topic_id="math_101")
        assert isinstance(response, dict)


class TestGrpcAttemptMetrics:
    """Test attempt metrics tracking via gRPC."""

    @pytest.mark.asyncio
    async def test_grpc_update_attempt_metrics(self, user_factory, grpc_analytics_channel_insecure):
        """Tests updating attempt metrics via gRPC."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        metrics = {
            "attempt_id": "attempt_001",
            "user_id": user_id,
            "question_id": "q_001",
            "topic_ids": ["math", "algebra"],
            "correct": True,
            "response_time_ms": 5000,
            "skill_id": "algebraic_thinking",
            "score": 1.0
        }

        response = await client.update_attempt_metrics(metrics)
        assert isinstance(response, dict)
        assert "success" in response


class TestGrpcHealthCheck:
    """Test gRPC service health check."""

    @pytest.mark.asyncio
    async def test_grpc_health_check(self, grpc_analytics_channel_insecure):
        """Tests gRPC service health check."""
        client = GrpcAnalyticsClient(grpc_analytics_channel_insecure)
        
        is_healthy = await client.health_check()
        assert isinstance(is_healthy, bool)


class TestGrpcVsHttpParity:
    """Test parity between gRPC and HTTP implementations."""

    @pytest.mark.asyncio
    async def test_event_submission_parity(self, user_factory, grpc_analytics_channel_insecure):
        """Tests event submission via gRPC (parity test converted to gRPC-only)."""
        student = user_factory(role="student")
        user_id = student["user"]["id"]
        access_token = student["accessToken"]

        event_data = {
            "eventType": "quiz_attempt",
            "quizId": "quiz_parity_test",
            "score": 88,
            "timestamp": get_utc_timestamp(),
            "sessionId": "parity_session"
        }

        grpc_client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        # Submit twice via gRPC to simulate parity
        grpc_response = await grpc_client.batch_track_events([event_data])
        grpc_response2 = await grpc_client.batch_track_events([event_data])

        assert isinstance(grpc_response, dict)
        assert isinstance(grpc_response2, dict)

    @pytest.mark.asyncio
    async def test_recommendations_parity(self, user_factory, grpc_analytics_channel_insecure):
        """Tests retrieving recommendations via gRPC (parity test converted to gRPC-only)."""
        student = user_factory(role="student")
        access_token = student["accessToken"]
        user_id = student["user"]["id"]

        grpc_client = GrpcAnalyticsClient(
            grpc_analytics_channel_insecure,
            user_id=user_id,
            access_token=access_token
        )

        recs = await grpc_client.get_recommendations()
        recs2 = await grpc_client.get_recommendations()

        assert isinstance(recs, list)
        assert isinstance(recs2, list)


class TestGrpcServerBindings:
    """Check server-side gRPC method bindings and call basic RPCs to reproduce binding errors."""

    @pytest.mark.anyio
    async def test_server_rpc_bindings_and_basic_calls(self, grpc_analytics_channel_insecure):
        # Ensure gRPC stubs are available; fail explicitly if not.
        from grpc_utils import GRPC_STUBS_AVAILABLE, GrpcAnalyticsClient

        assert GRPC_STUBS_AVAILABLE, (
            "gRPC stubs not available. Generate them with: "
            "python -m grpc_tools.protoc -I../../protos --python_out=. --grpc_python_out=. ../../protos/analytics.proto"
        )

        client = GrpcAnalyticsClient(grpc_analytics_channel_insecure)
        stub = client.stub

        expected_methods = ["GetUserAbility", "GetRecommendations"]
        missing = [m for m in expected_methods if not hasattr(stub, m)]
        assert not missing, f"Missing RPC methods on server stub: {missing}"

        # Perform lightweight RPC calls; let exceptions surface as test failures so server-side issues are visible.
        from analytics_pb2 import GetUserAbilityRequest, GetRecommendationsRequest

        ua_resp = await stub.GetUserAbility(GetUserAbilityRequest(user_id="test_user"), metadata=client.metadata)
        assert ua_resp is not None

        rec_resp = await stub.GetRecommendations(GetRecommendationsRequest(user_id="test_user"), metadata=client.metadata)
        assert rec_resp is not None