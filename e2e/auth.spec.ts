import { expect, test } from "@playwright/test";
import { DEMO, DEMO_PASSWORD, login, logout } from "./fixtures";

test("anonymous visitors are redirected to the login screen", async ({
  page,
}) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "TeamBoard" }),
  ).toBeVisible();
});

test("the demo account lands on the seeded dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Use demo account" }).click();
  await expect(page.getByLabel("Email")).toHaveValue(DEMO.maya.email);
  await expect(page.getByLabel("Password")).toHaveValue(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByRole("heading", { name: "Your projects" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Website Redesign" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mobile App Launch" }),
  ).toBeVisible();
});

test("a refresh keeps the session and logout clears it", async ({ page }) => {
  await login(page, DEMO.maya.email);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your projects" }),
  ).toBeVisible();

  await logout(page);
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login$/);
});

test("a wrong password shows the generic error and stays on login", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEMO.maya.email);
  await page.getByLabel("Password").fill("WrongPassword!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
  await expect(page).toHaveURL(/\/login$/);
});
