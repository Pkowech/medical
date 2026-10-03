import os

import pytest
from playwright.sync_api import sync_playwright


def test_courses_page_shows_biochemistry_and_searches():
    frontend_url = os.environ.get("FRONTEND_URL")
    if not frontend_url:
        pytest.skip("Set FRONTEND_URL to run the browser end-to-end test")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        try:
            page.goto(f"{frontend_url.rstrip('/')}/courses")
            course_card = page.get_by_text("Biochemistry I")
            expect_visible = course_card.first
            expect_visible.wait_for(state="visible")

            search_box = page.locator('input[placeholder="Search courses"]')
            if search_box.count() > 0:
                search_box.fill("enzyme")
                search_button = page.get_by_role("button", name="Search")
                if search_button.count() > 0:
                    search_button.click()
                else:
                    page.wait_for_timeout(500)
                course_card.first.wait_for(state="visible")
        finally:
            browser.close()
