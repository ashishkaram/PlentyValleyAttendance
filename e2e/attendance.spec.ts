import { expect, test } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test.beforeEach(async ({ page }) => {
  requireCredentials();
  await login(page);
});

test("attendance form: number and name, exclusive boxes, mark all, save and reopen", async ({ page }) => {
  // Back-entry of the first session (29 Sep 2026) for the initial squad.
  await page.goto("/attendance/2026-10-01");
  await expect(page.getByRole("heading", { name: "Thu 1 Oct 2026" })).toBeVisible();

  const rows = page.locator("fieldset li");
  expect(await rows.count()).toBeGreaterThan(0);

  // Clear any excused marks left by an earlier run ("Mark all present" keeps them).
  const excused = page.getByRole("checkbox", { name: /^Excused:/, checked: true });
  while ((await excused.count()) > 0) await excused.first().uncheck();

  await page.getByRole("button", { name: "Mark all present" }).click();
  const firstPresent = rows.first().getByRole("checkbox", { name: /^Present:/ });
  const firstExcused = rows.first().getByRole("checkbox", { name: /^Excused:/ });
  await expect(page.getByRole("checkbox", { name: /^Present:/, checked: false })).toHaveCount(0);

  // Ticking Excused clears Present.
  await firstExcused.check();
  await expect(firstExcused).toBeChecked();
  await expect(firstPresent).not.toBeChecked();

  // Neither ticked = absent.
  const second = rows.nth(1);
  await second.getByRole("checkbox", { name: /^Present:/ }).uncheck();

  await page.getByRole("button", { name: "Save attendance" }).click();
  await expect(page.getByText(/Attendance saved: \d+ present, 1 excused, 1 absent/)).toBeVisible();

  await page.reload();
  await expect(rows.first().getByRole("checkbox", { name: /^Excused:/ })).toBeChecked();
  await expect(rows.nth(1).getByRole("checkbox", { name: /^Present:/ })).not.toBeChecked();
  await expect(rows.nth(2).getByRole("checkbox", { name: /^Present:/ })).toBeChecked();
  await expect(page.getByText(/Last edited by/)).toBeVisible();
});

test("tap targets are at least 44px", async ({ page }) => {
  await page.goto("/attendance/2026-10-01");
  const boxes = page.locator("fieldset li label");
  const n = Math.min(await boxes.count(), 6);
  for (let i = 0; i < n; i++) {
    const box = await boxes.nth(i).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test("attendance page does not scroll sideways on a phone", async ({ page }) => {
  await page.goto("/attendance/2026-10-01");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
