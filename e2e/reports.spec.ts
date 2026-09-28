import { expect, test } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test.beforeEach(async ({ page }) => {
  requireCredentials();
  await login(page);
});

test("weekly report shows week and season columns and exports CSV and PDF", async ({ page }) => {
  await page.goto("/reports?week=2026-09-30");
  await expect(page.getByRole("heading", { name: "Weekly report" })).toBeVisible();
  await expect(page.getByText("Wed 30 Sep 2026 – Tue 6 Oct 2026", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Report week (Wednesday to Tuesday)")).toHaveValue("2026-09-30");
  await expect(page.getByRole("columnheader", { name: "Season to date" })).toBeVisible();

  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export CSV" }).click()]);
  expect(csv.suggestedFilename()).toBe("attendance-20260930-20261006.csv");
  const text = await (await csv.createReadStream()).toArray();
  expect(Buffer.concat(text).toString("utf8")).toContain("Week: attendance %");

  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export PDF" }).click()]);
  expect(pdf.suggestedFilename()).toBe("attendance-20260930-20261006.pdf");
  const bytes = Buffer.concat(await (await pdf.createReadStream()).toArray());
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
});

test("custom range report", async ({ page }) => {
  await page.goto("/reports");
  await page.getByRole("button", { name: "Custom range" }).click();
  await page.getByLabel("From", { exact: true }).fill("2026-09-29");
  await page.getByLabel("To", { exact: true }).fill("2026-10-31");
  await page.getByRole("button", { name: "Show report" }).click();
  await expect(page).toHaveURL(/start=2026-09-29&end=2026-10-31/);
  await expect(page.getByRole("heading", { name: "Custom report" })).toBeVisible();
});

test("no weekly report for a week entirely within the Christmas break", async ({ page }) => {
  await page.goto("/reports?week=2026-12-23");
  await expect(page.getByText(/entirely within a season break/)).toBeVisible();
});
