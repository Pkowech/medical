"""
gRPC utilities and helpers for analytics service tests.
Provides generated stubs and helper methods for gRPC communication.
"""

"""
Try to import generated gRPC stubs lazily.

The tests may generate the `analytics_pb2.py` and `analytics_pb2_grpc.py` files
during execution. To avoid a permanent false-negative when this module is
imported before the stubs exist, we defer importing the generated code until
`GrpcAnalyticsClient` is instantiated. Call `_load_stubs()` to attempt the
import; it will raise ImportError if the stubs are still missing.
"""

GRPC_STUBS_AVAILABLE = False


def _load_stubs():
    """Attempt to import generated protobuf/gRPC modules and bind names.

    This function mutates globals() to expose the symbols used below. It
    raises ImportError if the generated modules are not available.
    """
    global GRPC_STUBS_AVAILABLE
    if GRPC_STUBS_AVAILABLE:
        return

    import os, sys

    # Ensure this tests directory is on sys.path so generated stubs can be found
    tests_dir = os.path.dirname(__file__)
    if tests_dir not in sys.path:
        sys.path.insert(0, tests_dir)

    try:
        from analytics_pb2 import (
            BatchEventRequest,
            BatchEventResponse,
            EventPayload,
            PredictBKTRequest,
            PredictBKTResponse,
            HealthRequest,
            HealthResponse,
            GetUserAbilityRequest,
            GetUserAbilityResponse,
            GetRecommendationsRequest,
            GetRecommendationsResponse,
            GetEngagementMetricsRequest,
            GetEngagementMetricsResponse,
            PredictPerformanceRequest,
            PredictPerformanceResponse,
            AttemptMetricsRequest,
            UpdateAttemptMetricsResponse,
            GetNextAdaptiveQuestionRequest,
            GetNextAdaptiveQuestionResponse,
            QuizAttemptHistoryRequest,
            QuizAttemptHistoryResponse,
            NextStepsRequest,
            NextStepsResponse,
            StudyRecommendationsRequest,
            StudyRecommendationsResponse,
        )
        from analytics_pb2_grpc import AnalyticsServiceStub

        # Export imported names into module globals for use by the client methods
        g = globals()
        # locals() contains the imported symbols; copy them to module globals
        for k, v in locals().items():
            if k not in ("os", "sys"):
                g[k] = v
        GRPC_STUBS_AVAILABLE = True
    except ImportError:
        GRPC_STUBS_AVAILABLE = False
        raise


class GrpcAnalyticsClient:
    """
    Wrapper client for gRPC Analytics Service communication.
    Provides async/await interface for gRPC calls.
    """

    def __init__(self, channel, user_id: str = None, access_token: str = None):
        """
        Initialize gRPC Analytics client.
        
        Args:
            channel: gRPC channel
            user_id: User ID for authenticated calls (optional)
            access_token: Bearer token for authentication (optional)
        """
        # Ensure generated stubs are loaded at client initialization time. This
        # allows test code to generate the `analytics_pb2*` files earlier in the
        # run without leaving `GRPC_STUBS_AVAILABLE` permanently False.
        try:
            _load_stubs()
        except ImportError:
            raise RuntimeError(
                "gRPC stubs not available. Generate them with: "
                "python -m grpc_tools.protoc -I../../protos --python_out=. "
                "--grpc_python_out=. ../../protos/analytics.proto"
            )
        
        self.channel = channel
        orig_stub = AnalyticsServiceStub(channel)
        self.user_id = user_id
        self.access_token = access_token
        self.metadata = []
        
        if access_token:
            self.metadata = [("authorization", f"Bearer {access_token}")]
        # runtime helpers for sync vs async stubs
        import inspect, anyio
        self._anyio = anyio
        # Determine once whether stub methods are coroutine functions
        try:
            is_coro = inspect.iscoroutinefunction(orig_stub.GetHealth)
        except Exception:
            is_coro = False

        class _AsyncStubProxy:
            def __init__(self, stub, anyio, is_coro):
                self._stub = stub
                self._anyio = anyio
                self._is_coro = is_coro

            def __getattr__(self, name):
                attr = getattr(self._stub, name)
                if self._is_coro:
                    return attr
                if callable(attr):
                    async def _call(*args, **kwargs):
                        return await self._anyio.to_thread.run_sync(lambda: attr(*args, **kwargs))
                    return _call
                return attr

        self.stub = _AsyncStubProxy(orig_stub, anyio, is_coro)
        self._is_coroutine_stub = is_coro
    async def health_check(self) -> bool:
        """Check service health via gRPC."""
        try:
            request = HealthRequest()
            response = await self.stub.GetHealth(request, metadata=self.metadata)
            return response.status == "healthy"
        except Exception as e:
            print(f"Health check failed: {e}")
            return False

    async def batch_track_events(self, events: list) -> dict:
        """
        Submit a batch of analytics events.
        
        Args:
            events: List of event dictionaries with event_type, timestamp, etc.
            
        Returns:
            Response dict with success, processed, failed, message
        """
        event_payloads = []
        for event in events:
            payload = EventPayload()
            payload.event_type = event.get("eventType", "")
            payload.timestamp = event.get("timestamp", "")
            payload.session_id = event.get("sessionId", "")
            payload.duration = event.get("duration", 0)
            # Note: data field (google.protobuf.Value) would need special handling
            event_payloads.append(payload)

        request = BatchEventRequest(user_id=self.user_id, events=event_payloads)
        response = await self.stub.BatchTrackEvents(request, metadata=self.metadata)

        return {
            "success": response.success,
            "processed": response.processed,
            "failed": response.failed,
            "message": response.message,
        }

    async def get_user_ability(self, user_id: str = None) -> dict:
        """Get user ability/knowledge state via BKT model."""
        uid = user_id or self.user_id
        request = GetUserAbilityRequest(user_id=uid)
        response = await self.stub.GetUserAbility(request, metadata=self.metadata)

        return {
            "user_id": response.user_id,
            "estimated_ability": response.estimated_ability,
            "p_known_by_skill": dict(response.p_known_by_skill),
        }

    async def predict_bkt(self, skill_id: str, feature_vector: list = None) -> dict:
        """Predict knowledge state using Bayesian Knowledge Tracing."""
        request = PredictBKTRequest(
            user_id=self.user_id,
            skill_id=skill_id,
            feature_vector=feature_vector or []
        )
        response = await self.stub.PredictBKT(request, metadata=self.metadata)

        return {
            "p_known": response.p_known,
            "p_next_correct": response.p_next_correct,
        }

    async def get_recommendations(self, user_id: str = None, limit: int = 10) -> list:
        """Get personalized recommendations."""
        uid = user_id or self.user_id
        request = GetRecommendationsRequest(user_id=uid)
        response = await self.stub.GetRecommendations(request, metadata=self.metadata)

        return [
            {
                "id": item.id,
                "title": item.title if hasattr(item, "title") else None,
                "description": item.description if hasattr(item, "description") else None,
                "type": item.type if hasattr(item, "type") else None,
                "score": item.score,
                "reason": item.reason if hasattr(item, "reason") else None,
            }
            for item in response.items
        ]

    async def get_engagement_metrics(self, user_id: str = None) -> dict:
        """Get user engagement metrics."""
        uid = user_id or self.user_id
        request = GetEngagementMetricsRequest(user_id=uid)
        response = await self.stub.GetEngagementMetrics(request, metadata=self.metadata)

        return {
            "time_spent": getattr(response, "time_spent", None),
            "completion_rate": getattr(response, "completion_rate", None),
            "activity_frequency": getattr(response, "activity_frequency", None),
            "daily_streak": getattr(response, "daily_streak", None),
            "weekly_streak": getattr(response, "weekly_streak", None),
        }

    async def predict_performance(self, user_id: str = None, skill_id: str = "") -> dict:
        """Predict user's future performance.

        The proto requires both `user_id` and `skill_id` in the request; server
        may reject empty `skill_id` values.
        """
        uid = user_id or self.user_id
        request = PredictPerformanceRequest(user_id=uid, skill_id=skill_id)
        response = await self.stub.PredictPerformance(request, metadata=self.metadata)

        return {
            "score": getattr(response, "score", None),
        }

    async def update_attempt_metrics(self, attempt_metrics: dict) -> dict:
        """Update metrics for a specific attempt."""
        request = AttemptMetricsRequest(
            attempt_id=attempt_metrics.get("attempt_id", ""),
            user_id=attempt_metrics.get("user_id", self.user_id),
            question_id=attempt_metrics.get("question_id", ""),
            topic_ids=attempt_metrics.get("topic_ids", []),
            correct=attempt_metrics.get("correct", False),
            response_time_ms=attempt_metrics.get("response_time_ms", 0),
            skill_id=attempt_metrics.get("skill_id", ""),
            score=attempt_metrics.get("score", 0.0),
        )
        response = await self.stub.UpdateAttemptMetrics(request, metadata=self.metadata)

        return {
            "success": response.success,
            "message": response.message,
        }

    async def get_next_adaptive_question(self, topic_id: str = None) -> dict:
        """Get next adaptive question recommendation."""
        request = GetNextAdaptiveQuestionRequest(
            user_id=self.user_id,
            topic_id=topic_id or ""
        )
        response = await self.stub.GetNextAdaptiveQuestion(request, metadata=self.metadata)

        return {
            "question_id": response.question_id,
            "recommended_difficulty": response.recommended_difficulty,
        }

    async def get_quiz_attempt_history(self, limit: int = 10, offset: int = 0) -> list:
        """Get user's quiz attempt history."""
        request = QuizAttemptHistoryRequest(
            user_id=self.user_id,
            limit=limit,
            offset=offset
        )
        response = await self.stub.GetQuizAttemptHistory(request, metadata=self.metadata)

        return [
            {
                "quiz_id": item.quiz_id,
                "score": item.score,
                "date": item.date,
            }
            for item in response.attempts
        ]

    async def generate_next_steps(self) -> list:
        """Generate personalized next learning steps."""
        request = NextStepsRequest(user_id=self.user_id)
        response = await self.stub.GenerateNextSteps(request, metadata=self.metadata)

        return [
            {
                "step": item.step,
                "reason": item.reason,
                "estimated_duration_minutes": item.estimated_duration_minutes,
            }
            for item in response.steps
        ]

    async def generate_study_recommendations(self, knowledge_gaps: list = None) -> list:
        """Generate study recommendations based on knowledge gaps."""
        request = StudyRecommendationsRequest(
            user_id=self.user_id,
            knowledge_gaps=knowledge_gaps or []
        )
        response = await self.stub.GenerateStudyRecommendations(request, metadata=self.metadata)

        return [
            {
                "recommendation": item.recommendation,
                "priority": item.priority,
                "estimated_time_hours": item.estimated_time_hours,
                "resource_id": item.resource_id,
            }
            for item in response.recommendations
        ]
