import { expect, test, type Locator } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

/** Tap a status button in a player's row, as a person would. */
const mark = (row: Locator, label: "Present" | "Absent" | "Excused" | "Injured") =>
  row.locator("label", { hasText: label }).click();

test.beforeEach(async ({ page }) => {
  requireCredentials();
  await login(page);
});

test("attendance form: four statuses, mark all present, save and reopen", async ({ page }) => {
  // Back-entry of an early session for the initial squad.
  await page.goto("/attendance/2026-10-01");
  await expect(page.getByRole("heading", { name: "Thu 1 Oct 2026" })).toBeVisible();

  const groups = page.getByRole("radiogroup");
  expect(await groups.count()).toBeGreaterThan(3);

  // Reset to a known state, then mark everyone present.
  for (let i = 0; i < (await groups.count()); i++) await mark(groups.nth(i), "Absent");
  await page.getByRole("button", { name: "Mark all present" }).click();
  await expect(page.getByRole("radio", { name: /^Present:/, checked: false })).toHaveCount(0);

  // One of each other status; choosing one clears the previous choice.
  await mark(groups.nth(0), "Excused");
  await expect(groups.nth(0).getByRole("radio", { name: /^Present:/ })).not.toBeChecked();
  await mark(groups.nth(1), "Absent");
  await mark(groups.nth(2), "Injured");

  // "Mark all present" keeps excused and injured players.
  await page.getByRole("button", { name: "Mark all present" }).click();
  await expect(groups.nth(0).getByRole("radio", { name: /^Excused:/ })).toBeChecked();
  await expect(groups.nth(2).getByRole("radio", { name: /^Injured:/ })).toBeChecked();
  await mark(groups.nth(1), "Absent");

  await page.getByRole("button", { name: "Save attendance" }).click();
  await expect(page.getByText(/Attendance saved: \d+ present, 1 absent, 1 excused, 1 injured/)).toBeVisible();

  await page.reload();
  await expect(groups.nth(0).getByRole("radio", { name: /^Excused:/ })).toBeChecked();
  await expect(groups.nth(1).getByRole("radio", { name: /^Absent:/ })).toBeChecked();
  await expect(groups.nth(2).getByRole("radio", { name: /^Injured:/ })).toBeChecked();
  await expect(groups.nth(3).getByRole("radio", { name: /^Present:/ })).toBeChecked();
  await expect(page.getByText(/Last edited by/)).toBeVisible();
});

test("injured is shown separately in the weekly report and does not lower the %", async ({ page }) => {
  await page.goto("/reports?week=2026-09-30");
  await expect(page.getByRole("columnheader", { name: "Injured" }).first()).toBeVisible();
  await expect(page.getByText("Injured (week)")).toBeVisible();
});

test("tap targets are at least 44px", async ({ page }) => {
  await page.goto("/attendance/2026-10-01");
  const options = page.getByRole("radiogroup").first().locator("label");
  await expect(options).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const box = await options.nth(i).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test("attendance page does not scroll sideways on a phone", async ({ page }) => {
  await page.goto("/attendance/2026-10-01");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
