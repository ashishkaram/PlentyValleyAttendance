import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hasCredentials, login } from "./helpers";

/** Automated WCAG 2.1 A/AA checks. Manual checks are still needed (see README). */
async function check(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("login page has no detectable WCAG 2.1 AA violations", async ({ page }) => {
  await page.goto("/login");
  await check(page);
});

for (const path of ["/", "/players", "/players/new", "/players/upload", "/attendance/2026-10-01", "/sessions", "/reports?week=2026-09-30", "/settings"]) {
  test(`${path} has no detectable WCAG 2.1 AA violations`, async ({ page }) => {
    test.skip(!hasCredentials, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");
    await login(page);
    await page.goto(path);
    await check(page);
  });
}
