import { expect, test, type Page } from "@playwright/test";

export const hasCredentials = !!(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

export function requireCredentials() {
  test.skip(!hasCredentials, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/");
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;
