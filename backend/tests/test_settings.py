"""Integration coverage for onboarding and account settings endpoints."""

import base64
import hashlib
import hmac
import struct
import time


def response_data(response):
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def auth_headers(user):
    return {"Authorization": f"Bearer {user['accessToken']}"}


def current_totp(secret):
    key = base64.b32decode(secret.upper() + "=" * (-len(secret) % 8))
    counter = int(time.time() // 30)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{code % 1_000_000:06d}"


def test_settings_round_trip_and_preserve_unrelated_preferences(user_factory):
    user = user_factory(role="student")
    headers = auth_headers(user)
    base_url = user_factory.base_url
    existing_preferences = {"studyTargets": {"daily": 45, "weekly": 315}}

    profile_response = user_factory.session.patch(
        f"{base_url}/users/{user['user']['id']}",
        headers=headers,
        json={
            "careerStage": "student",
            "healthcareField": "pharmacy",
            "studyYear": 2,
            "specialization": "clinical pharmacy",
            "preferences": existing_preferences,
        },
    )
    assert profile_response.status_code == 200, profile_response.text

    payload = {
        "theme": "dark",
        "notifications": {
            "email": False,
            "push": True,
            "weeklyDigest": False,
            "progress": False,
        },
        "security": {"loginNotifications": False, "twoFactorEnabled": True},
        "preferences": {"language": "sw", "timezone": "Africa/Kampala"},
        "privacy": {
            "profileVisibility": "public",
            "showEmail": False,
            "showPhone": False,
            "showLocation": False,
            "allowMessages": False,
        },
    }

    update_response = user_factory.session.put(
        f"{base_url}/users/settings", headers=headers, json=payload
    )
    assert update_response.status_code == 200, update_response.text

    settings_response = user_factory.session.get(
        f"{base_url}/users/settings", headers=headers
    )
    assert settings_response.status_code == 200, settings_response.text
    settings = response_data(settings_response)

    assert settings["email"] == user["user"]["email"]
    assert settings["theme"] == "dark"
    assert settings["notifications"] == payload["notifications"]
    assert settings["security"]["loginNotifications"] is False
    assert settings["security"]["twoFactorEnabled"] is False
    assert settings["preferences"] == payload["preferences"]
    assert settings["privacy"] == payload["privacy"]

    profile = response_data(
        user_factory.session.get(
            f"{base_url}/users/profile", headers=headers
        )
    )
    assert profile["careerStage"] == "student"
    assert profile["healthcareField"] == "pharmacy"
    assert profile["studyYear"] == 2
    assert profile["specialization"] == "clinical pharmacy"


def test_private_profile_is_not_visible_to_other_users(user_factory):
    owner = user_factory(role="student")
    viewer = user_factory(role="student")
    base_url = user_factory.base_url

    update_response = user_factory.session.put(
        f"{base_url}/users/settings",
        headers=auth_headers(owner),
        json={"privacy": {"profileVisibility": "private"}},
    )
    assert update_response.status_code == 200, update_response.text

    response = user_factory.session.get(
        f"{base_url}/users/profile/{owner['user']['id']}",
        headers=auth_headers(viewer),
    )
    assert response.status_code == 403, response.text


def test_public_profile_hides_contact_fields_by_default(user_factory):
    owner = user_factory(role="student")
    viewer = user_factory(role="student")

    response = user_factory.session.get(
        f"{user_factory.base_url}/users/profile/{owner['user']['id']}",
        headers=auth_headers(viewer),
    )
    assert response.status_code == 200, response.text
    profile = response_data(response)

    assert "email" not in profile
    assert "phoneNumber" not in profile
    assert "location" not in profile


def test_allow_messages_setting_blocks_new_direct_conversations(user_factory):
    owner = user_factory(role="student")
    sender = user_factory(role="student")
    base_url = user_factory.base_url

    update_response = user_factory.session.put(
        f"{base_url}/users/settings",
        headers=auth_headers(owner),
        json={"privacy": {"allowMessages": False}},
    )
    assert update_response.status_code == 200, update_response.text

    response = user_factory.session.post(
        f"{base_url}/chat/conversations",
        headers=auth_headers(sender),
        json={"targetUserId": owner["user"]["id"]},
    )
    assert response.status_code == 403, response.text


def test_settings_reject_unsupported_language_and_timezone(user_factory):
    user = user_factory(role="student")
    response = user_factory.session.put(
        f"{user_factory.base_url}/users/settings",
        headers=auth_headers(user),
        json={"preferences": {"language": "xx", "timezone": "Mars/Olympus"}},
    )
    assert response.status_code == 400, response.text


def test_two_factor_requires_a_valid_authenticator_code(user_factory):
    user = user_factory(role="student")
    headers = auth_headers(user)
    base_url = user_factory.base_url

    setup_response = user_factory.session.post(
        f"{base_url}/auth/security/2fa/setup", headers=headers
    )
    assert setup_response.status_code == 201, setup_response.text
    setup = response_data(setup_response)
    assert setup.get("secret")
    assert setup.get("qrCode", "").startswith("data:image/")

    invalid_response = user_factory.session.post(
        f"{base_url}/auth/security/2fa/verify",
        headers=headers,
        json={"token": "000000"},
    )
    assert invalid_response.status_code == 200, invalid_response.text
    assert response_data(invalid_response)["valid"] is False

    settings_response = user_factory.session.get(
        f"{base_url}/auth/security/settings", headers=headers
    )
    assert settings_response.status_code == 200, settings_response.text
    assert response_data(settings_response)["twoFactorEnabled"] is False

    enable_response = user_factory.session.post(
        f"{base_url}/auth/security/2fa/verify",
        headers=headers,
        json={"token": current_totp(setup["secret"])},
    )
    assert enable_response.status_code == 200, enable_response.text
    assert response_data(enable_response)["valid"] is True

    settings_response = user_factory.session.get(
        f"{base_url}/auth/security/settings", headers=headers
    )
    assert response_data(settings_response)["twoFactorEnabled"] is True

    disable_response = user_factory.session.post(
        f"{base_url}/auth/security/2fa/disable",
        headers=headers,
        json={"token": current_totp(setup["secret"])},
    )
    assert disable_response.status_code == 201, disable_response.text

    settings_response = user_factory.session.get(
        f"{base_url}/auth/security/settings", headers=headers
    )
    assert response_data(settings_response)["twoFactorEnabled"] is False
