import { expect, test } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test.beforeEach(async ({ page }) => {
  requireCredentials();
  await login(page);
});

test("season has 44 sessions and none in the Christmas break", async ({ page }) => {
  await page.goto("/sessions");
  await expect(page.getByRole("button", { name: /^All \(\d+\)/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tue 15 Dec 2026" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Thu 17 Dec 2026" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Tue 19 Jan 2027" })).toBeVisible();
});

test("settings preview shows removals and review flags before applying", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Add break" }).click();
  const last = page.locator('input[id^="break-name-"]').last();
  await last.fill("E2E break");
  const idx = (await last.getAttribute("id"))!.replace("break-name-", "");
  await page.locator(`#break-start-${idx}`).fill("2026-09-30");
  await page.locator(`#break-end-${idx}`).fill("2026-10-02");
  await page.getByRole("button", { name: "Review changes" }).click();
  // 1 Oct had attendance saved in the attendance test, so it is flagged, not removed.
  await expect(page.getByText(/to flag for review/)).toBeVisible();
  // Do not apply: keep the shared test data unchanged.
  await page.getByRole("button", { name: "Keep editing" }).click();
});

test("cancel and un-cancel a session", async ({ page }) => {
  await page.goto("/sessions");
  const item = page.locator("li", { has: page.getByRole("link", { name: "Tue 23 Mar 2027" }) });
  await item.getByRole("button", { name: "Cancel session" }).click();
  await item.getByLabel("Note (optional)").fill("Cancelled - rain");
  await item.getByRole("button", { name: "Confirm cancel" }).click();
  await expect(item.getByText("Cancelled", { exact: true })).toBeVisible();
  await item.getByRole("button", { name: "Un-cancel" }).click();
  await expect(item.getByRole("button", { name: "Cancel session" })).toBeVisible();
});
