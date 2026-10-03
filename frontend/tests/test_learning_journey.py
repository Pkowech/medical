import json
import os
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

import pytest
from dotenv import dotenv_values


FRONTEND_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = FRONTEND_ROOT.parent / "backend"

def configured_service_url(*names: str, default: str) -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value.rstrip("/")
    return default


def configured_backend_base_url() -> str:
    base_url = configured_service_url(
        "BACKEND_BASE_URL",
        "BACKEND_URL",
        default="http://localhost:3002",
    )
    return base_url if base_url.endswith("/v1") else f"{base_url}/v1"


def analytics_grpc_metadata() -> tuple[tuple[str, str], ...]:
    api_key = os.environ.get("RUST_ANALYTICS_API_KEY")
    if not api_key:
        api_key = dotenv_values(FRONTEND_ROOT.parent / ".env").get(
            "RUST_ANALYTICS_API_KEY"
        )
    if not api_key:
        pytest.fail("Set RUST_ANALYTICS_API_KEY in the environment or repository .env")
    return (("x-api-key", api_key),)


def read_frontend(path: str) -> str:
    return (FRONTEND_ROOT / path).read_text(encoding="utf-8")


def read_backend(path: str) -> str:
    return (BACKEND_ROOT / path).read_text(encoding="utf-8")


def test_registration_establishes_a_session_before_profile_setup():
    registration = read_frontend("src/app/(auth)/register/page.tsx")
    finish_setup = read_frontend("src/app/(auth)/finish-setup/page.tsx")

    assert "router.push('/login?callbackUrl=%2Ffinish-setup')" in registration
    assert "router.push('/onboarding')" in finish_setup


def test_new_user_can_skip_optional_profile_but_still_get_onboarding():
    finish_setup = read_frontend("src/app/(auth)/finish-setup/page.tsx")
    onboarding = read_frontend("src/app/(app)/onboarding/page.tsx")

    assert "Profile details are optional, but new users should still see onboarding." in finish_setup
    assert "router.push('/onboarding')" in finish_setup
    assert "onboardingCompleted: true" in onboarding
    assert "setFinished(true)" in onboarding
    assert "setStep(4)" in onboarding
    assert "Start Learning" in onboarding
    assert "router.push('/dashboard')" in onboarding


def test_new_learner_has_course_discovery_and_learning_path_entry_points():
    courses = read_frontend("src/features/courses/components/courses-dashboard.tsx")
    learning_paths = read_frontend("src/app/(app)/learning-paths/LearningPathsClient.tsx")

    assert "You haven't enrolled in any courses yet." in courses
    assert "Explore Catalog" in courses
    assert "setActiveTab('discover')" in courses
    assert "<LearningPathInterface />" in learning_paths


def test_real_quiz_questions_are_loaded_from_unit_or_topic_endpoint_without_answer_keys():
    quiz_service = read_frontend("src/features/assessment/services/quiz.ts")
    quiz_panel = read_frontend("src/features/courses/components/QuizPanel.tsx")
    backend_quiz = read_backend("src/modules/education/assessment/services/quiz.service.ts")

    question_loader = quiz_service.split("async getQuestionsForLesson", 1)[1].split(
        "async submitAnswer", 1
    )[0]
    assert "${this.baseUrl}/${scope}/${lessonId}" in question_loader
    assert "getDemoRapidReviewQuestions" not in question_loader
    assert "result.correct" in quiz_panel
    assert "option.isCorrect" not in quiz_panel
    assert "question_text: question.text" in read_frontend(
        "src/shared/hooks/useQuiz.ts"
    )
    assert "option.id" in read_frontend("src/app/(app)/quiz/[unitId]/page.tsx")

    for method_name in ("getQuestionsByUnit", "getQuestionsByTopic"):
        query = backend_quiz.split(f"async {method_name}", 1)[1].split(
            "@ApiOperation", 1
        )[0]
        assert "select: { id: true, text: true, order: true }" in query
        assert "isCorrect" not in query

    unit_loader = backend_quiz.split("async getQuestionsByUnit", 1)[1].split(
        "@ApiOperation", 1
    )[0]
    assert "this.prisma.quiz.findFirst" in unit_loader
    assert "where: { unitId, topicId: null, isPublished: true }" in unit_loader
    assert "quiz.questions.map(({ question }) => question)" in unit_loader
    assert "this.prisma.question.findMany" in unit_loader
    assert "where: { unitId }" in unit_loader


def test_quiz_submission_accepts_quiz_ids_and_resolves_published_unit_quizzes():
    quiz_service = read_backend(
        "src/modules/education/assessment/services/quiz.service.ts"
    )
    submit = quiz_service.split("async submitQuiz(", 1)[1].split(
        "@ApiOperation({ summary: 'Submit a topic-level quiz'", 1
    )[0]

    assert "this.prisma.quiz.findUnique" in submit
    assert "where: { id: unitId }" in submit
    assert "this.prisma.quiz.findFirst" in submit
    assert "where: { unitId, topicId: null, isPublished: true }" in submit
    assert "tx.autoGeneratedQuiz.updateMany" in submit
    assert "completedAt: null" in submit
    assert "if (result.autoQuizCompleted)" in submit
    assert "this.eventEmitter.emit('auto-quiz.completed'" in submit


def test_quiz_submission_is_single_online_request_and_offline_queue_uses_real_route():
    quiz_hook = read_frontend("src/shared/hooks/useQuiz.ts")

    assert "'/quizzes/submit/${currentState.id}'" not in quiz_hook
    assert quiz_hook.count("addToOutbox(") == 1
    offline_branch = quiz_hook.split("if (isOffline) {", 1)[1].split("try {", 1)[0]
    assert "addToOutbox" in offline_branch
    assert "apiService.post" not in offline_branch
    assert "'/quizzes/submit?type=full'" in quiz_hook


def test_quiz_completion_records_activity_and_calls_analytics():
    quiz_service = read_backend("src/modules/education/assessment/services/quiz.service.ts")

    assert "await tx.userActivity.create" in quiz_service
    assert "type: UserActivityType.QUIZ_ATTEMPT" in quiz_service
    assert "await this.analyticsService.generateAnalytics(userId, activeQuiz.id)" in quiz_service
    assert "bktUpdates.push({ skillId, isCorrect: gradingResult.isCorrect })" in quiz_service
    assert "for (const { skillId, isCorrect } of bktUpdates)" in quiz_service
    assert ".updateBktForAssessment(userId, skillId, isCorrect)" in quiz_service


def test_auto_quiz_completion_persists_activity_and_is_idempotent():
    controller = read_backend(
        "src/modules/education/assessment/controllers/quiz.controller.ts"
    )
    orchestration = read_backend(
        "src/modules/education/assessment/services/weakness-orchestration.service.ts"
    )

    assert "this.orchestrationService.completeAutoQuiz(" in controller
    assert "this.orchestrationService['eventEmitter']" not in controller
    assert "async completeAutoQuiz(" in orchestration
    assert "maxScore <= 0" in orchestration
    assert "score > maxScore" in orchestration
    assert "tx.autoGeneratedQuiz.updateMany(" in orchestration
    assert "where: { userId, quizId, completedAt: null }" in orchestration
    assert "tx.userActivity.create(" in orchestration
    assert "type: UserActivityType.QUIZ_ATTEMPT" in orchestration
    assert "this.eventEmitter.emit('auto-quiz.completed'" in orchestration
    assert "if (recorded)" in orchestration


def test_material_progress_and_streak_share_user_activity_dates():
    progress_service = read_backend("src/modules/education/courses/services/progress.service.ts")

    assert "type: UserActivityType.LEARNING" in progress_service
    assert "async getUserStreaks(userId" in progress_service
    assert "createdAt: {" in progress_service
    assert "toDateString()" in progress_service


def request_status(
    url: str,
    method: str = "GET",
    body: dict | None = None,
    headers: dict[str, str] | None = None,
    follow_redirects: bool = True,
) -> tuple[int, bytes]:
    encoded_body = json.dumps(body).encode("utf-8") if body is not None else None
    request_headers = {"Content-Type": "application/json", **(headers or {})}
    request = Request(
        url,
        data=encoded_body,
        method=method,
        headers=request_headers,
    )
    try:
        if follow_redirects:
            response_context = urlopen(request, timeout=15)
        else:
            class NoRedirectHandler(HTTPRedirectHandler):
                def redirect_request(self, req, fp, code, msg, response_headers, new_url):
                    return None

            response_context = build_opener(NoRedirectHandler).open(request, timeout=15)
        with response_context as response:
            return response.status, response.read()
    except HTTPError as response:
        return response.code, response.read()
    except TimeoutError as error:
        pytest.fail(f"Timed out requesting {url}: {error}")
    except URLError as error:
        pytest.fail(f"Live service is unavailable at {url}: {error.reason}")


def register_smoke_user(base_url: str) -> dict[str, str]:
    unique_id = uuid.uuid4().hex
    password = "SmokeTest-Password-123!"
    status, body = request_status(
        f"{base_url}/auth/register",
        method="POST",
        body={
            "email": f"frontend-smoke-{unique_id}@example.com",
            "username": f"frontend-smoke-{unique_id}",
            "password": password,
            "confirmPassword": password,
            "firstName": "Frontend",
            "lastName": "SmokeTest",
            "role": "student",
            "acceptTerms": True,
        },
    )
    assert status == 201, body.decode("utf-8", errors="replace")

    registration = json.loads(body)
    registration_data = registration.get("data", registration)
    return {"Authorization": f"Bearer {registration_data['accessToken']}"}


@pytest.fixture(scope="session")
def smoke_auth_headers() -> dict[str, str]:
    base_url = configured_backend_base_url()
    return register_smoke_user(base_url)


def assert_frontend_get_routes(base_url: str, auth_headers: dict[str, str], routes: tuple[str, ...]):
    for route in routes:
        status, body = request_status(f"{base_url}{route}", headers=auth_headers)
        assert status == 200, f"GET {route} returned {status}: {body!r}"
        json.loads(body)


def test_registration_and_profile_setup_routes_render_or_require_authentication():
    base_url = configured_service_url(
        "FRONTEND_BASE_URL",
        "FRONTEND_URL",
        default="http://localhost:3000",
    )

    for path in ("/register", "/login?callbackUrl=%2Ffinish-setup"):
        status, _ = request_status(f"{base_url}{path}")
        assert status == 200, f"Public page {path} returned HTTP {status}"

    for path in ("/finish-setup", "/onboarding"):
        status, _ = request_status(f"{base_url}{path}", follow_redirects=False)
        assert status == 307, f"Protected page {path} should redirect, got HTTP {status}"


def test_backend_auth_and_learning_routes_are_present_and_protected():
    base_url = configured_backend_base_url()

    login_status, _ = request_status(
        f"{base_url}/auth/login", method="POST", body={}
    )
    quiz_status, _ = request_status(
        f"{base_url}/quizzes/submit?type=full", method="POST", body={}
    )
    read_status, _ = request_status(
        f"{base_url}/progress/materials/00000000-0000-0000-0000-000000000000/read",
        method="POST",
        body={},
    )
    auto_quiz_status, _ = request_status(
        f"{base_url}/quizzes/assessments/auto-quiz/complete",
        method="POST",
        body={"quizId": "00000000-0000-0000-0000-000000000000", "score": 1, "maxScore": 1},
    )

    assert login_status == 400
    assert quiz_status == 401
    assert read_status == 401
    assert auto_quiz_status == 401


def test_authenticated_frontend_analytics_requests_reach_backend_and_rust(smoke_auth_headers):
    base_url = configured_backend_base_url()

    routes = (
        ("/assessment-progress/recommendations", dict),
        ("/assessment-progress/study-materials?gaps=frontend-smoke-test", list),
        ("/assessment-progress/next-steps", list),
    )
    for route, expected_type in routes:
        status, response_body = request_status(
            f"{base_url}{route}", headers=smoke_auth_headers
        )
        assert status == 200, f"{route} returned {status}: {response_body!r}"
        response_data = json.loads(response_body)
        if isinstance(response_data, dict) and "data" in response_data:
            response_data = response_data["data"]
        assert isinstance(response_data, expected_type), route


def test_frontend_course_requests_reach_backend(smoke_auth_headers):
    base_url = configured_backend_base_url()
    assert_frontend_get_routes(
        base_url,
        smoke_auth_headers,
        (
            "/courses?page=1&limit=3",
            "/courses/featured?limit=3",
            "/courses/recommended?limit=3",
            "/courses/my-courses?page=1&limit=3",
            "/courses/overview",
        ),
    )


def test_frontend_material_requests_reach_backend(smoke_auth_headers):
    base_url = configured_backend_base_url()
    assert_frontend_get_routes(
        base_url,
        smoke_auth_headers,
        (
            "/materials",
            "/materials/paginated?page=1&limit=3",
        ),
    )


def test_frontend_learning_requests_reach_backend_and_rust(smoke_auth_headers):
    base_url = configured_backend_base_url()
    assert_frontend_get_routes(
        base_url,
        smoke_auth_headers,
        (
            "/learning-paths/my-progress",
            "/learning-paths/discovery/trending?limit=3",
            "/learning-paths/discovery/personalized?limit=3",
            "/learning-paths/discovery/collaborative?limit=3",
            "/learning-goals",
            "/learning-goals/active",
            "/learning-goals/completed",
            "/learning-goals/analytics",
            "/progress/me",
        ),
    )


def test_analytics_grpc_health():
    import grpc
    import sys

    sys.path.insert(0, str(BACKEND_ROOT / "tests"))
    import grpc_utils

    grpc_utils._load_stubs()
    target = configured_service_url(
        "ANALYTICS_GRPC_URL",
        "RUST_ANALYTICS_GRPC_URL",
        "ANALYTICS_GRPC_TARGET",
        default="localhost:50051",
    )
    channel = grpc.insecure_channel(target)
    try:
        response = grpc_utils.AnalyticsServiceStub(channel).GetHealth(
            grpc_utils.HealthRequest(), metadata=analytics_grpc_metadata(), timeout=5
        )
    except grpc.RpcError as error:
        pytest.fail(f"Analytics gRPC GetHealth failed: {error.code().name}")
    finally:
        channel.close()

    assert response.status == "ok"


def test_analytics_grpc_recommendations():
    import grpc
    import sys

    sys.path.insert(0, str(BACKEND_ROOT / "tests"))
    import analytics_pb2
    import grpc_utils

    grpc_utils._load_stubs()
    target = configured_service_url(
        "ANALYTICS_GRPC_URL",
        "RUST_ANALYTICS_GRPC_URL",
        "ANALYTICS_GRPC_TARGET",
        default="localhost:50051",
    )
    channel = grpc.insecure_channel(target)
    try:
        response = grpc_utils.AnalyticsServiceStub(channel).GetRecommendations(
            analytics_pb2.GetRecommendationsRequest(
                user_id=f"frontend-smoke-{uuid.uuid4().hex}"
            ),
            metadata=analytics_grpc_metadata(),
            timeout=10,
        )
    except grpc.RpcError as error:
        pytest.fail(f"Analytics gRPC GetRecommendations failed: {error.code().name}: {error.details()}")
    finally:
        channel.close()

    assert response is not None
    assert hasattr(response, "items")


def test_analytics_grpc_learning_summary_uses_submitted_data_without_db_writes():
    import grpc
    import sys

    sys.path.insert(0, str(BACKEND_ROOT / "tests"))
    import analytics_pb2
    import grpc_utils

    grpc_utils._load_stubs()
    target = configured_service_url(
        "ANALYTICS_GRPC_URL",
        "RUST_ANALYTICS_GRPC_URL",
        "ANALYTICS_GRPC_TARGET",
        default="localhost:50051",
    )
    channel = grpc.insecure_channel(target)
    stub = grpc_utils.AnalyticsServiceStub(channel)
    user_id = "pytest-read-only-analytics"
    metadata = analytics_grpc_metadata()

    try:
        response = stub.GetUserLearningSummary(
            analytics_pb2.GetUserLearningSummaryRequest(
                user_id=user_id,
                study_sessions=[
                    analytics_pb2.StudySession(
                        user_id=user_id,
                        duration=30,
                        topic="pytest",
                        score=80,
                    )
                ],
                quiz_attempts=[
                    analytics_pb2.QuizAttempt(
                        user_id=user_id,
                        percentage=90,
                        category="pytest",
                    )
                ],
            ),
            timeout=5,
            metadata=metadata,
        )
        assert response.HasField("summary")
        assert response.summary.total_study_time == 30
        assert response.summary.average_score > 0

        with pytest.raises(grpc.RpcError) as error:
            stub.GetUserLearningSummary(
                analytics_pb2.GetUserLearningSummaryRequest(
                    user_id=user_id,
                    study_sessions=[
                        analytics_pb2.StudySession(
                            user_id=user_id,
                            duration=30,
                            topic="pytest",
                            score=101,
                        )
                    ],
                ),
                timeout=5,
                metadata=metadata,
            )
        assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    finally:
        channel.close()
