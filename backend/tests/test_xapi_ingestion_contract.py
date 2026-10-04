from uuid import uuid4


def response_payload(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def test_xapi_statement_is_attributed_to_the_authenticated_user_and_deduplicated(
    user_factory,
):
    student = user_factory(role="student")
    headers = {"Authorization": f"Bearer {student['accessToken']}"}
    statement_id = str(uuid4())
    statement = {
        "id": statement_id,
        "actor": {
            "name": "Test Learner",
            "mbox": f"mailto:{student['email']}",
        },
        "verb": {
            "id": "http://adlnet.gov/expapi/verbs/experienced",
            "display": {"en-US": "experienced"},
        },
        "object": {
            "id": f"https://example.test/learning-activities/{uuid4()}",
            "definition": {
                "name": {"en-US": "Learning activity"},
                "type": "http://adlnet.gov/expapi/activities/lesson",
            },
        },
    }

    first_response = user_factory.session.post(
        f"{user_factory.base_url}/progress/statements",
        headers=headers,
        json=statement,
        timeout=30,
    )
    assert first_response.status_code == 201, first_response.text
    first = response_payload(first_response)

    duplicate_response = user_factory.session.post(
        f"{user_factory.base_url}/progress/statements",
        headers=headers,
        json=statement,
        timeout=30,
    )
    assert duplicate_response.status_code == 201, duplicate_response.text
    duplicate = response_payload(duplicate_response)

    assert first["id"] == duplicate["id"]
    assert first["statementId"] == statement_id
    assert duplicate["statementId"] == statement_id
    assert first["userId"] == student["id"]
    assert duplicate["userId"] == student["id"]
