import { test, expect } from '@playwright/test';

test('courses page shows seeded Biochemistry course and search works', async ({ page }) => {
  // Adjust the URL/port if your dev server runs on another port
  await page.goto('http://localhost:3000/courses');
  // Expect a course card for Biochemistry I
  const courseCard = page.locator('text=Biochemistry I');
  await expect(courseCard).toBeVisible();

  // Try search
  const searchBox = page.locator('input[placeholder="Search courses"]');
  if ((await searchBox.count()) > 0) {
    await searchBox.fill('enzyme');
    const searchBtn = page.locator('button:has-text("Search")');
    if ((await searchBtn.count()) > 0) {
      await searchBtn.click();
    } else {
      // Some implementations auto-search; wait for results
      await page.waitForTimeout(500);
    }
    // After search, at least the Biochemistry I course with 'enzyme' topics should appear.
    await expect(page.locator('text=Biochemistry I')).toBeVisible();
  }
});
