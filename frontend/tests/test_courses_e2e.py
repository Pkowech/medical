import os
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright


def test_courses_catalog_is_public():
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        try:
            response = page.goto(
                f"{frontend_url.rstrip('/')}/courses",
                wait_until="domcontentloaded",
                timeout=90000,
            )
            assert response is not None
            assert response.status == 200
            assert page.url.rstrip("/").endswith("/courses")
        finally:
            browser.close()


def test_course_preview_is_public_but_enrollment_prompts_for_sign_in():
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        try:
            page.route(
                "**/api/backend/courses/course-preview**",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"success":true,"data":{"id":"course-preview","title":"Preview Course","units":[]}}',
                ),
            )
            response = page.goto(
                f"{frontend_url}/courses/course-preview",
                wait_until="domcontentloaded",
                timeout=90000,
            )
            assert response is not None
            assert response.status == 200
            page.get_by_role("heading", name="Preview Course").wait_for()

            enrollment_link = page.get_by_role("link", name="Sign in to enroll")
            assert enrollment_link.is_visible()
            enrollment_link.click()
            page.wait_for_url("**/login?callbackUrl=**")
            callback_url = parse_qs(urlparse(page.url).query)["callbackUrl"][0]
            assert callback_url == "/courses/course-preview"
        finally:
            browser.close()


def test_learning_content_route_redirects_guests_to_sign_in():
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    protected_path = "/courses/course-preview/units/unit-preview"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        try:
            page.goto(
                f"{frontend_url}{protected_path}",
                wait_until="domcontentloaded",
                timeout=90000,
            )
            page.wait_for_url("**/login?callbackUrl=**")
            callback_url = parse_qs(urlparse(page.url).query)["callbackUrl"][0]
            assert callback_url == protected_path
        finally:
            browser.close()
