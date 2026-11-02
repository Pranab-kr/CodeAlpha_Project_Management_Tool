import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "Password123!";
export const DEMO = {
  maya: { email: "maya@teamboard.dev", name: "Maya Chen" },
  dev: { email: "dev@teamboard.dev", name: "Dev Patel" },
  sam: { email: "sam@teamboard.dev", name: "Sam Rivera" },
} as const;

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export async function login(
  page: Page,
  email: string,
  password = DEMO_PASSWORD,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function createProject(page: Page, name: string) {
  await page
    .getByRole("main")
    .getByRole("button", { name: "New project" })
    .click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

export async function openProject(page: Page, name: string) {
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

export async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

export async function addMember(page: Page, email: string) {
  await openSettings(page);
  await page.getByRole("tab", { name: "Members" }).click();
  await page.getByRole("button", { name: "Add member" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a member" });
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText(email).first()).toBeVisible();
}

export async function createTask(
  page: Page,
  title: string,
  options: {
    column?: string;
    assignee?: string;
    priority?: "Low" | "Medium" | "High" | "Urgent";
    dueDate?: string;
  } = {},
) {
  const column = options.column ?? "Backlog";
  const region = page.getByRole("region", { name: `${column} column` });
  await region.getByRole("button", { name: "Add task" }).click();

  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel("Title").fill(title);
  if (options.dueDate) {
    await dialog.getByLabel("Due date").fill(options.dueDate);
  }
  if (options.priority) {
    await dialog.getByLabel("Priority").click();
    await page.getByRole("option", { name: options.priority }).click();
  }
  if (options.assignee) {
    await dialog.getByLabel("Assignee").click();
    await page.getByRole("option", { name: options.assignee }).click();
  }
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toBeVisible();
}
