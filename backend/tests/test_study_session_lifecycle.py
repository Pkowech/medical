def response_payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def test_short_study_session_is_not_counted_as_learning_activity(
    user_factory,
):
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}
    base_url = user_factory.base_url
    session = user_factory.session

    start_response = session.post(
        f"{base_url}/study/session/start",
        headers=headers,
        json={},
        timeout=30,
    )
    assert start_response.status_code == 201, start_response.text
    started = response_payload(start_response)

    end_response = session.put(
        f"{base_url}/study/session/{started['id']}/end",
        headers=headers,
        json={"activities": [], "durationSeconds": 0},
        timeout=30,
    )
    assert end_response.status_code == 200, end_response.text
    ended = response_payload(end_response)

    assert ended["id"] == started["id"]
    assert ended["duration"] == 0
    assert ended["isValid"] is False
    assert ended["invalidReason"]

    activity_response = session.get(
        f"{base_url}/progress/activities",
        headers=headers,
        timeout=30,
    )
    assert activity_response.status_code == 200, activity_response.text
    activities = response_payload(activity_response)
    assert not any(
        (activity.get("details") or {}).get("sessionId") == started["id"]
        for activity in activities
    )

    dashboard_response = session.get(
        f"{base_url}/progress/dashboard/{student['id']}",
        headers=headers,
        timeout=30,
    )
    assert dashboard_response.status_code == 200, dashboard_response.text
    dashboard = response_payload(dashboard_response)
    assert dashboard["streaks"]["currentStreak"] == 0
    assert dashboard["streaks"]["longestStreak"] == 0


def test_ending_a_study_session_twice_does_not_change_its_outcome(user_factory):
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}
    base_url = user_factory.base_url
    session = user_factory.session

    start_response = session.post(
        f"{base_url}/study/session/start",
        headers=headers,
        json={},
        timeout=30,
    )
    assert start_response.status_code == 201, start_response.text
    started = response_payload(start_response)

    first_end_response = session.put(
        f"{base_url}/study/session/{started['id']}/end",
        headers=headers,
        json={"activities": [], "durationSeconds": 0},
        timeout=30,
    )
    assert first_end_response.status_code == 200, first_end_response.text
    first_end = response_payload(first_end_response)

    second_end_response = session.put(
        f"{base_url}/study/session/{started['id']}/end",
        headers=headers,
        json={"activities": [], "durationSeconds": 600},
        timeout=30,
    )
    assert second_end_response.status_code == 200, second_end_response.text
    second_end = response_payload(second_end_response)

    assert second_end["id"] == first_end["id"]
    assert second_end["endTime"] == first_end["endTime"]
    assert second_end["duration"] == first_end["duration"]
    assert second_end["isValid"] is first_end["isValid"]
