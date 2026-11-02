import { expect, test } from "@playwright/test";
import {
  DEMO,
  addMember,
  createProject,
  createTask,
  login,
  openProject,
  openSettings,
  uniqueName,
} from "./fixtures";

test("two users collaborate with notifications and live updates", async ({
  browser,
}) => {
  const mayaContext = await browser.newContext();
  const devContext = await browser.newContext();
  const maya = await mayaContext.newPage();
  const dev = await devContext.newPage();

  const projectName = uniqueName("E2E Collab");
  const renamedProject = `${projectName} renamed`;
  const taskTitle = uniqueName("E2E task");

  await login(maya, DEMO.maya.email);
  await createProject(maya, projectName);
  await addMember(maya, DEMO.dev.email);

  const projectPath = new URL(maya.url()).pathname.replace(/\/settings$/, "");
  await maya.goto(projectPath);
  await createTask(maya, taskTitle, {
    assignee: DEMO.dev.name,
    priority: "High",
    dueDate: "2026-12-15",
  });

  await login(dev, DEMO.dev.email);
  await openProject(dev, projectName);
  await expect(
    dev.getByRole("button", { name: new RegExp(taskTitle) }),
  ).toBeVisible();

  // Dev gets the assignment notification and it opens the task drawer.
  await dev.getByRole("button", { name: "Notifications" }).click();
  const notificationButton = dev.getByRole("button", {
    name: new RegExp(`assigned you ${taskTitle}`),
  });
  await expect(notificationButton).toBeVisible();
  await notificationButton.click();
  await expect(dev).toHaveURL(/task=/);
  await expect(dev.getByRole("dialog", { name: "Task details" })).toBeVisible();
  await dev.keyboard.press("Escape");

  // Maya moves the task to In Progress; Dev sees it without reload. The move is
  // issued with Maya's session because dnd-kit pointer geometry is unreliable
  // in headless Chromium; drag behaviour is covered by component tests.
  const projectId = new URL(maya.url()).pathname.split("/").pop();
  const projectResponse = await maya.request.get(
    `/api/v1/projects/${projectId}`,
  );
  const columns = (await projectResponse.json()).data.project.columns as {
    id: string;
    name: string;
  }[];
  const tasksResponse = await maya.request.get(
    `/api/v1/projects/${projectId}/tasks`,
  );
  const createdTask = (
    (await tasksResponse.json()).data.tasks as { id: string; title: string }[]
  ).find((task) => task.title === taskTitle);
  const inProgress = columns.find((column) => column.name === "In Progress");
  expect(createdTask).toBeDefined();
  expect(inProgress).toBeDefined();
  const moveResponse = await maya.request.patch(
    `/api/v1/tasks/${createdTask?.id}/move`,
    { data: { columnId: inProgress?.id } },
  );
  expect(moveResponse.ok()).toBe(true);

  await expect(
    dev.getByRole("region", { name: "In Progress column" }),
  ).toContainText(taskTitle);

  // Dev comments; Maya's card count updates live.
  await dev
    .getByRole("region", { name: "In Progress column" })
    .getByRole("button", { name: new RegExp(taskTitle) })
    .click();
  const devDrawer = dev.getByRole("dialog", { name: "Task details" });
  await devDrawer.getByRole("textbox", { name: "Comment" }).fill("Looks good");
  await devDrawer.getByRole("button", { name: "Post comment" }).click();
  await expect(devDrawer.getByText("Looks good")).toBeVisible();
  await expect(
    maya
      .getByRole("button", { name: new RegExp(taskTitle) })
      .getByLabel("1 comments"),
  ).toBeVisible();
  await dev.keyboard.press("Escape");

  // Maya renames the project; Dev's header updates live.
  await openSettings(maya);
  await maya.getByLabel("Project name").fill(renamedProject);
  await maya.getByRole("button", { name: "Save changes" }).click();
  await expect(maya.getByText("Project updated")).toBeVisible();
  await expect(dev.getByRole("banner")).toContainText(renamedProject);

  // Maya removes Dev; the open tab tears down.
  await maya.getByRole("tab", { name: "Members" }).click();
  await maya.getByRole("button", { name: "Remove Dev Patel" }).click();
  await maya.getByRole("button", { name: "Remove member" }).click();
  await expect(dev).toHaveURL(/\/projects$/);
  await expect(
    dev.getByText("This project is no longer available"),
  ).toBeVisible();

  await dev.goto(projectPath);
  await expect(
    dev.getByRole("heading", { name: "Project not found" }),
  ).toBeVisible();

  // Maya deletes the project; the dashboard no longer lists it.
  await maya.getByRole("tab", { name: "Danger zone" }).click();
  await maya
    .getByLabel("Type the project name to confirm")
    .fill(renamedProject);
  await maya.getByRole("button", { name: "Delete project" }).click();
  await expect(maya).toHaveURL(/\/projects$/);
  await expect(maya.getByRole("heading", { name: renamedProject })).toHaveCount(
    0,
  );

  await mayaContext.close();
  await devContext.close();
});
