import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { DEMO, login, openProject, openSettings } from "./fixtures";

const SCREENSHOT_DIR = "docs/screenshots";
const viewport = { width: 1440, height: 900 };

test.use({ viewport });

test("capture the seeded demo screens", async ({ browser }) => {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const mayaContext = await browser.newContext({ viewport });
  const maya = await mayaContext.newPage();
  await login(maya, DEMO.maya.email);
  await maya.screenshot({ path: `${SCREENSHOT_DIR}/01-dashboard.png` });

  await openProject(maya, "Website Redesign");
  await maya.screenshot({ path: `${SCREENSHOT_DIR}/02-board.png` });

  await maya
    .getByRole("button", { name: /Build the new design tokens/ })
    .click();
  await expect(
    maya.getByRole("dialog", { name: "Task details" }),
  ).toBeVisible();
  await maya.screenshot({ path: `${SCREENSHOT_DIR}/03-task-drawer.png` });
  await maya.keyboard.press("Escape");

  await openSettings(maya);
  await maya.getByRole("tab", { name: "Members" }).click();
  await maya.screenshot({ path: `${SCREENSHOT_DIR}/05-settings-members.png` });

  const devContext = await browser.newContext({ viewport });
  const dev = await devContext.newPage();
  await login(dev, DEMO.dev.email);
  await dev.getByRole("button", { name: "Notifications" }).click();
  await expect(
    dev.getByRole("list", { name: "Notifications list" }),
  ).toBeVisible();
  await dev.screenshot({ path: `${SCREENSHOT_DIR}/04-notifications.png` });

  await mayaContext.close();
  await devContext.close();
});
