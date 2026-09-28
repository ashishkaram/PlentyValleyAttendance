import { expect, test } from "@playwright/test";
import { login, requireCredentials, unique } from "./helpers";

test.beforeEach(async ({ page }) => {
  requireCredentials();
  await login(page);
});

test("add, edit, deactivate and reactivate a player", async ({ page }) => {
  const name = unique("E2E Player");
  await page.goto("/players/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Player number (optional)").fill("99");
  await page.getByLabel("Active from").fill("2026-09-29");
  await page.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByRole("status")).toContainText(`${name} added`);

  await page.goto("/players");
  await page.getByLabel("Search players").fill(name);
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("still in the squad")).toBeVisible();

  await page.getByLabel("Player number (optional)").fill("98");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();

  await page.getByRole("button", { name: "Deactivate" }).click();
  await page.getByRole("button", { name: `Yes, deactivate ${name}` }).click();
  await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();
  await page.getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByRole("button", { name: "Deactivate" })).toBeVisible();
});

test("name is required and active-from cannot be before the season", async ({ page }) => {
  await page.goto("/players/new");
  await page.getByLabel("Name").fill("   ");
  await page.getByLabel("Active from").fill("2026-09-29");
  // Bypass browser validation to check the server-side rule.
  await page.locator("main form").evaluate((f: HTMLFormElement) => (f.noValidate = true));
  await page.getByRole("button", { name: "Add player" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Name is required");

  await page.getByLabel("Name").fill(unique("Early"));
  await page.getByLabel("Active from").fill("2026-09-01");
  await page.getByRole("button", { name: "Add player" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("before the season start");
});

test("bulk upload previews rows, flags errors and duplicates, and summarises", async ({ page }) => {
  const a = unique("Upload A");
  const csv = [
    "Name,Player number,Active from",
    `${a},31,29/09/2026`,
    `${a.toUpperCase()},32,`,
    ",33,",
    "Ava Sample,1,not-a-date",
  ].join("\n");
  await page.goto("/players/upload");
  await expect(page.getByLabel("Default active-from date for blank rows")).toHaveValue(/2026-\d\d-\d\d/);
  await page.getByLabel("Players file (CSV or Excel)").setInputFiles({ name: "squad.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await expect(page.getByText("Same name as row 2")).toBeVisible();
  await expect(page.getByText("Name is required")).toBeVisible();
  await expect(page.getByText(/Invalid "Active from" date/)).toBeVisible();

  await page.getByLabel("Action for row 3").selectOption("add");
  await page.getByRole("button", { name: /Import 2 rows/ }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
  const summary = page.locator("dl");
  await expect(summary).toContainText("Added2");
  await expect(summary).toContainText("Errors2");
});
