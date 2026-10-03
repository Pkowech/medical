import os

from playwright.sync_api import sync_playwright


def test_courses_route_requires_authentication():
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        try:
            page.goto(f"{frontend_url.rstrip('/')}/courses")
            page.wait_for_url("**/login?callbackUrl=**")
            page.get_by_role("heading", name="Sign in to your account").wait_for()
        finally:
            browser.close()
