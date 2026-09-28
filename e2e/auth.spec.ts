import { expect, test } from "@playwright/test";
import { login, requireCredentials } from "./helpers";

test("unauthenticated visitors are sent to the login page and see no data", async ({ page }) => {
  for (const path of ["/", "/players", "/attendance", "/reports", "/settings", "/reports/export?format=csv&start=2026-09-29&end=2026-10-06"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toBeVisible();
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("incorrect");
});

test("forgot password always confirms without revealing accounts", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("reset link");
});

test("manager can log in, stays signed in, and log out", async ({ page, context }) => {
  requireCredentials();
  await login(page);
  const cookies = await context.cookies();
  const auth = cookies.find((c) => c.name.includes("auth-token"));
  expect(auth, "auth cookie set").toBeTruthy();
  // Persistent login: the cookie lasts about 30 days, not just the browser session.
  const days = (auth!.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(29);
  expect(days).toBeLessThan(31);

  await page.goto("/players");
  await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/players");
  await expect(page).toHaveURL(/\/login$/);
});
