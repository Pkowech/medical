"""
Python Integration Tests for Student Progress Tracking

Tests complete workflows for:
- Study progress (course enrollment, unit completion, course rollup)
- Assessment progress (quiz attempts, scoring, best score tracking)
- Learning metrics (streaks, milestones, velocity)
"""

import pytest
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import time


class ProgressTrackingTests:
    """Integration tests for student progress tracking"""

    BASE_URL = "http://localhost:3000/api"
    TIMEOUT = 30

    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None

    def setup_user(self) -> Tuple[str, str]:
        """Create a new test user and return (user_id, auth_token)"""
        email = f"test-{int(time.time())}-{int(time.time()*1000)%1000}@example.com"
        payload = {
            "email": email,
            "password": "TestPass123!",
            "firstName": "Test",
            "lastName": "User",
        }

        response = self.session.post(
            f"{self.BASE_URL}/auth/signup",
            json=payload,
            timeout=self.TIMEOUT,
        )

        assert response.status_code == 201, f"Signup failed: {response.text}"

        data = response.json()
        self.user_id = data["user"]["id"]
        self.auth_token = data["token"]

        return self.user_id, self.auth_token

    def get_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        return {"Authorization": f"Bearer {self.auth_token}"}

    # =====================================================================
    # STUDY PROGRESS TRACKING TESTS
    # =====================================================================

    def test_course_enrollment_tracking(self):
        """Test tracking of course enrollment"""
        print("\n[TEST] Course Enrollment Tracking")

        self.setup_user()

        # Create course
        course_payload = {
            "title": "Course Enrollment Test",
            "description": "Test course",
            "duration": 20,
        }

        response = self.session.post(
            f"{self.BASE_URL}/courses",
            json=course_payload,
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        assert response.status_code == 201
        course_id = response.json()["id"]

        # Enroll in course
        response = self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/enroll",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        assert response.status_code == 201
        enroll_data = response.json()

        assert enroll_data["userId"] == self.user_id
        assert enroll_data["courseId"] == course_id
        assert enroll_data["status"] == "notStarted"
        assert enroll_data["progressPercentage"] == 0
        assert enroll_data["completedUnits"] == 0

        print(f"✓ Course enrollment tracked: {enroll_data}")

    def test_unit_completion_workflow(self):
        """Test complete workflow: create units, complete them, track progress"""
        print("\n[TEST] Unit Completion Workflow")

        self.setup_user()

        # Create course
        course_response = self.session.post(
            f"{self.BASE_URL}/courses",
            json={"title": "Unit Test Course", "description": "Test", "duration": 20},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_id = course_response.json()["id"]

        # Create 3 units
        unit_ids = []
        for i in range(3):
            unit_response = self.session.post(
                f"{self.BASE_URL}/courses/{course_id}/units",
                json={
                    "title": f"Unit {i+1}",
                    "description": f"Unit {i+1}",
                    "order": i + 1,
                },
                headers=self.get_headers(),
                timeout=self.TIMEOUT,
            )

            assert unit_response.status_code == 201
            unit_ids.append(unit_response.json()["id"])

        # Enroll
        self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/enroll",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        # Complete units and track progress
        progress_percentages = []

        for i, unit_id in enumerate(unit_ids):
            # Start unit
            start_response = self.session.post(
                f"{self.BASE_URL}/units/{unit_id}/start",
                headers=self.get_headers(),
                timeout=self.TIMEOUT,
            )

            assert start_response.status_code == 201

            # Simulate studying
            time.sleep(0.5)

            # Complete unit
            complete_response = self.session.post(
                f"{self.BASE_URL}/units/{unit_id}/complete",
                headers=self.get_headers(),
                timeout=self.TIMEOUT,
            )

            assert complete_response.status_code == 200

            # Get course progress
            course_response = self.session.get(
                f"{self.BASE_URL}/courses/{course_id}/progress",
                headers=self.get_headers(),
                timeout=self.TIMEOUT,
            )

            course_progress = course_response.json()
            progress_percentages.append(course_progress["progressPercentage"])

            print(
                f"  Unit {i+1} completed: Course progress = {course_progress['progressPercentage']}%"
            )

        # Verify progression
        assert len(progress_percentages) == 3
        assert progress_percentages[0] > 0
        assert progress_percentages[1] > progress_percentages[0]
        assert progress_percentages[2] >= 100

        print(f"✓ Unit completion tracked: {progress_percentages}")

    def test_course_completion_state(self):
        """Test that course transitions to completed state"""
        print("\n[TEST] Course Completion State")

        self.setup_user()

        # Create course with 1 unit
        course_response = self.session.post(
            f"{self.BASE_URL}/courses",
            json={"title": "Completion Test", "description": "Test", "duration": 10},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_id = course_response.json()["id"]

        unit_response = self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/units",
            json={"title": "Unit 1", "description": "Unit", "order": 1},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        unit_id = unit_response.json()["id"]

        # Enroll
        self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/enroll",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        # Complete unit
        self.session.post(
            f"{self.BASE_URL}/units/{unit_id}/complete",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        # Check course progress
        progress_response = self.session.get(
            f"{self.BASE_URL}/courses/{course_id}/progress",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_progress = progress_response.json()

        assert course_progress["status"] == "completed"
        assert course_progress["progressPercentage"] == 100
        assert "completedAt" in course_progress

        print(f"✓ Course completion state verified: {course_progress['status']}")

    def test_time_tracking_on_units(self):
        """Test that time spent is tracked on units"""
        print("\n[TEST] Time Tracking on Units")

        self.setup_user()

        # Create course and unit
        course_response = self.session.post(
            f"{self.BASE_URL}/courses",
            json={"title": "Time Test", "description": "Test", "duration": 10},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_id = course_response.json()["id"]

        unit_response = self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/units",
            json={"title": "Unit 1", "description": "Unit", "order": 1},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        unit_id = unit_response.json()["id"]

        # Enroll
        self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/enroll",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        # Start unit
        self.session.post(
            f"{self.BASE_URL}/units/{unit_id}/start",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        # Simulate work (2 seconds minimum)
        time.sleep(2)

        # Complete unit
        unit_response = self.session.post(
            f"{self.BASE_URL}/units/{unit_id}/complete",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        unit_progress = unit_response.json()

        assert "timeSpent" in unit_progress
        assert unit_progress["timeSpent"] >= 2000  # At least 2 seconds in ms

        print(f"✓ Time tracking verified: {unit_progress['timeSpent']}ms spent")

    # =====================================================================
    # ASSESSMENT PROGRESS TRACKING TESTS
    # =====================================================================

    def test_quiz_attempt_recording(self):
        """Test that quiz attempts are recorded"""
        print("\n[TEST] Quiz Attempt Recording")

        self.setup_user()

        # Setup course, unit, and quiz
        course_response = self.session.post(
            f"{self.BASE_URL}/courses",
            json={"title": "Quiz Test", "description": "Test", "duration": 10},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_id = course_response.json()["id"]

        unit_response = self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/units",
            json={"title": "Unit 1", "description": "Unit", "order": 1},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        unit_id = unit_response.json()["id"]

        quiz_response = self.session.post(
            f"{self.BASE_URL}/units/{unit_id}/quiz",
            json={
                "title": "Test Quiz",
                "description": "Quiz",
                "passingScore": 70,
                "maxAttempts": 3,
            },
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        quiz_id = quiz_response.json()["id"]

        # Submit quiz
        answers = [
            {"questionId": "q1", "selectedOption": "option-a"},
            {"questionId": "q2", "selectedOption": "option-b"},
        ]

        response = self.session.post(
            f"{self.BASE_URL}/quiz/{quiz_id}/submit",
            json={"answers": answers},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        assert response.status_code == 201
        attempt = response.json()

        assert attempt["quizId"] == quiz_id
        assert attempt["userId"] == self.user_id
        assert "percentage" in attempt
        assert "completedAt" in attempt

        print(f"✓ Quiz attempt recorded: score = {attempt['percentage']}%")

    def test_best_score_tracking(self):
        """Test that best score is tracked across attempts"""
        print("\n[TEST] Best Score Tracking")

        self.setup_user()

        # Setup
        course_response = self.session.post(
            f"{self.BASE_URL}/courses",
            json={"title": "Score Test", "description": "Test", "duration": 10},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_id = course_response.json()["id"]

        unit_response = self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/units",
            json={"title": "Unit 1", "description": "Unit", "order": 1},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        unit_id = unit_response.json()["id"]

        quiz_response = self.session.post(
            f"{self.BASE_URL}/units/{unit_id}/quiz",
            json={
                "title": "Score Quiz",
                "description": "Quiz",
                "passingScore": 70,
                "maxAttempts": 5,
            },
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        quiz_id = quiz_response.json()["id"]

        # Submit with 3 different scores: 50, 80, 60
        scores = [50, 80, 60]
        recorded_scores = []

        for score in scores:
            answers = [
                {"questionId": f"q{i}", "selectedOption": "option-a"}
                for i in range(int(score / 10))
            ]

            response = self.session.post(
                f"{self.BASE_URL}/quiz/{quiz_id}/submit",
                json={"answers": answers},
                headers=self.get_headers(),
                timeout=self.TIMEOUT,
            )

            recorded_scores.append(response.json()["percentage"])

        # Get quiz progress
        progress_response = self.session.get(
            f"{self.BASE_URL}/quiz/{quiz_id}/progress",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        quiz_progress = progress_response.json()

        assert quiz_progress["bestScore"] == max(recorded_scores)
        assert quiz_progress["totalAttempts"] == 3

        print(
            f"✓ Best score tracked: attempts={recorded_scores}, best={quiz_progress['bestScore']}"
        )

    def test_max_attempts_enforcement(self):
        """Test that maximum attempts is enforced"""
        print("\n[TEST] Max Attempts Enforcement")

        self.setup_user()

        # Setup
        course_response = self.session.post(
            f"{self.BASE_URL}/courses",
            json={"title": "Attempts Test", "description": "Test", "duration": 10},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_id = course_response.json()["id"]

        unit_response = self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/units",
            json={"title": "Unit 1", "description": "Unit", "order": 1},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        unit_id = unit_response.json()["id"]

        quiz_response = self.session.post(
            f"{self.BASE_URL}/units/{unit_id}/quiz",
            json={
                "title": "Limited Quiz",
                "description": "Quiz",
                "passingScore": 90,
                "maxAttempts": 2,  # Only 2 attempts
            },
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        quiz_id = quiz_response.json()["id"]

        answers = [{"questionId": "q1", "selectedOption": "option-a"}]

        # First 2 attempts should succeed
        for i in range(2):
            response = self.session.post(
                f"{self.BASE_URL}/quiz/{quiz_id}/submit",
                json={"answers": answers},
                headers=self.get_headers(),
                timeout=self.TIMEOUT,
            )

            assert response.status_code == 201
            print(f"  Attempt {i+1}: Success")

        # Third attempt should fail
        response = self.session.post(
            f"{self.BASE_URL}/quiz/{quiz_id}/submit",
            json={"answers": answers},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        assert response.status_code == 400
        print(f"  Attempt 3: Correctly rejected (max attempts exceeded)")

    # =====================================================================
    # LEARNING METRICS TRACKING TESTS
    # =====================================================================

    def test_study_streak_tracking(self):
        """Test study streak calculation and tracking"""
        print("\n[TEST] Study Streak Tracking")

        self.setup_user()

        # Create 5 study sessions for consecutive days
        for i in range(5):
            date = (datetime.now() - timedelta(days=4 - i)).isoformat()

            response = self.session.post(
                f"{self.BASE_URL}/user/{self.user_id}/study-session",
                json={"duration": 3600000, "date": date},  # 1 hour
                headers=self.get_headers(),
                timeout=self.TIMEOUT,
            )

            assert response.status_code == 201
            print(f"  Study session {i+1}: Created")

        # Check streak
        response = self.session.get(
            f"{self.BASE_URL}/user/{self.user_id}/streaks",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        streak_data = response.json()

        assert streak_data["currentStreak"] == 5
        assert streak_data["longestStreak"] == 5

        print(f"✓ Study streak tracked: current={streak_data['currentStreak']}")

    def test_milestone_achievement(self):
        """Test milestone tracking and achievement dates"""
        print("\n[TEST] Milestone Achievement")

        self.setup_user()

        # Complete a course to trigger milestone
        course_response = self.session.post(
            f"{self.BASE_URL}/courses",
            json={"title": "Milestone Course", "description": "Test", "duration": 10},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_id = course_response.json()["id"]

        unit_response = self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/units",
            json={"title": "Unit 1", "description": "Unit", "order": 1},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        unit_id = unit_response.json()["id"]

        # Enroll and complete
        self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/enroll",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        self.session.post(
            f"{self.BASE_URL}/units/{unit_id}/complete",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        # Check milestones
        response = self.session.get(
            f"{self.BASE_URL}/user/{self.user_id}/milestones",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        milestones = response.json()

        assert len(milestones) > 0
        assert "achievedAt" in milestones[0]

        print(f"✓ Milestone achievement tracked: {len(milestones)} milestones")

    def test_learning_path_progress(self):
        """Test learning path progress aggregation"""
        print("\n[TEST] Learning Path Progress")

        self.setup_user()

        # Create learning path
        path_response = self.session.post(
            f"{self.BASE_URL}/learning-paths",
            json={
                "title": "Test Learning Path",
                "description": "Path for testing",
            },
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        assert path_response.status_code == 201
        path_id = path_response.json()["id"]

        # Enroll
        response = self.session.post(
            f"{self.BASE_URL}/learning-paths/{path_id}/enroll",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        assert response.status_code == 201
        initial_progress = response.json()

        assert initial_progress["overallProgressPercentage"] == 0
        assert initial_progress["status"] == "notStarted"

        print(f"✓ Learning path progress tracked: enrolled successfully")

    # =====================================================================
    # PROGRESS AGGREGATION AND CONSISTENCY TESTS
    # =====================================================================

    def test_progress_consistency(self):
        """Test consistency between unit and course progress"""
        print("\n[TEST] Progress Consistency")

        self.setup_user()

        # Create course with 2 units
        course_response = self.session.post(
            f"{self.BASE_URL}/courses",
            json={"title": "Consistency Test", "description": "Test", "duration": 10},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_id = course_response.json()["id"]

        unit_ids = []
        for i in range(2):
            unit_response = self.session.post(
                f"{self.BASE_URL}/courses/{course_id}/units",
                json={
                    "title": f"Unit {i+1}",
                    "description": f"Unit {i+1}",
                    "order": i + 1,
                },
                headers=self.get_headers(),
                timeout=self.TIMEOUT,
            )

            unit_ids.append(unit_response.json()["id"])

        # Enroll
        self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/enroll",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        # Complete 1 unit
        self.session.post(
            f"{self.BASE_URL}/units/{unit_ids[0]}/complete",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        # Get course progress
        response = self.session.get(
            f"{self.BASE_URL}/courses/{course_id}/progress",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_progress = response.json()

        assert course_progress["completedUnits"] == 1
        assert 40 < course_progress["progressPercentage"] < 60  # ~50%

        print(
            f"✓ Progress consistency verified: 1/2 units = {course_progress['progressPercentage']}%"
        )

    def test_overall_progress_dashboard(self):
        """Test comprehensive progress dashboard"""
        print("\n[TEST] Overall Progress Dashboard")

        self.setup_user()

        # Perform various activities
        # 1. Complete a course
        course_response = self.session.post(
            f"{self.BASE_URL}/courses",
            json={"title": "Dashboard Course", "description": "Test", "duration": 10},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        course_id = course_response.json()["id"]

        unit_response = self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/units",
            json={"title": "Unit 1", "description": "Unit", "order": 1},
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        unit_id = unit_response.json()["id"]

        self.session.post(
            f"{self.BASE_URL}/courses/{course_id}/enroll",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        self.session.post(
            f"{self.BASE_URL}/units/{unit_id}/complete",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        # 2. Add study sessions
        for i in range(3):
            self.session.post(
                f"{self.BASE_URL}/user/{self.user_id}/study-session",
                json={"duration": 1800000, "date": datetime.now().isoformat()},
                headers=self.get_headers(),
                timeout=self.TIMEOUT,
            )

        # Get dashboard
        response = self.session.get(
            f"{self.BASE_URL}/user/{self.user_id}/progress-dashboard",
            headers=self.get_headers(),
            timeout=self.TIMEOUT,
        )

        assert response.status_code == 200
        dashboard = response.json()

        assert "coursesEnrolled" in dashboard
        assert "coursesCompleted" in dashboard
        assert "totalStudyTime" in dashboard
        assert "overallProgressPercentage" in dashboard

        assert dashboard["coursesEnrolled"] >= 1
        assert dashboard["coursesCompleted"] >= 1

        print(f"✓ Progress dashboard: {dashboard['coursesCompleted']} courses completed")


# =====================================================================
# TEST EXECUTION
# =====================================================================

if __name__ == "__main__":
    tests = ProgressTrackingTests()

    # Study Progress Tests
    tests.test_course_enrollment_tracking()
    tests.test_unit_completion_workflow()
    tests.test_course_completion_state()
    tests.test_time_tracking_on_units()

    # Assessment Progress Tests
    tests.test_quiz_attempt_recording()
    tests.test_best_score_tracking()
    tests.test_max_attempts_enforcement()

    # Learning Metrics Tests
    tests.test_study_streak_tracking()
    tests.test_milestone_achievement()
    tests.test_learning_path_progress()

    # Consistency Tests
    tests.test_progress_consistency()
    tests.test_overall_progress_dashboard()

    print("\n" + "=" * 70)
    print("✓ ALL PROGRESS TRACKING TESTS COMPLETED SUCCESSFULLY")
    print("=" * 70)
