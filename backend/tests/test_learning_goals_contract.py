def response_payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def test_goal_analytics_matches_frontend_contract(user_factory):
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}

    response = user_factory.session.get(
        f"{user_factory.base_url}/learning-goals/analytics",
        headers=headers,
        timeout=30,
    )
    assert response.status_code == 200, response.text
    analytics = response_payload(response)

    assert isinstance(analytics["totalGoals"], int)
    assert isinstance(analytics["activeGoals"], int)
    assert isinstance(analytics["completedGoals"], int)
    assert isinstance(analytics["overdueGoals"], int)
    assert isinstance(analytics["completionRate"], (int, float))
    assert isinstance(analytics["averageCompletionTimeDays"], (int, float))
    assert isinstance(analytics["goalsByCategory"], dict)
    assert isinstance(analytics["goalsByPriority"], dict)
    assert isinstance(analytics["streakData"]["currentStreak"], int)
    assert isinstance(analytics["streakData"]["longestStreak"], int)
    assert isinstance(analytics["upcomingDeadlines"], list)

    if analytics["upcomingDeadlines"]:
        deadline = analytics["upcomingDeadlines"][0]
        assert {"goalId", "title", "targetDate", "daysRemaining"} <= deadline.keys()
