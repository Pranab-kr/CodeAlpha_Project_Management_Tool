import { expect, test } from "@playwright/test";
import { DEMO, login, openProject } from "./fixtures";

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`no horizontal page overflow at ${viewport.name} width`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await login(page, DEMO.maya.email);
    await openProject(page, "Website Redesign");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const backlogWidth = await page
      .getByRole("region", { name: "Backlog column" })
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(backlogWidth).toBeLessThanOrEqual(
      Math.min(320, viewport.width * 0.9) + 1,
    );

    if (viewport.width < 1024) {
      await expect(
        page.getByRole("button", { name: "Open navigation" }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("button", { name: "Open navigation" }),
      ).toHaveCount(0);
    }

    if (viewport.width < 640) {
      await page
        .getByRole("button", { name: /Build the new design tokens/ })
        .click();
      const drawer = page.getByRole("dialog", { name: "Task details" });
      await expect(drawer).toBeVisible();
      const drawerWidth = await drawer.evaluate(
        (element) => element.getBoundingClientRect().width,
      );
      expect(drawerWidth).toBeGreaterThanOrEqual(viewport.width - 1);
      expect(
        await drawer.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }

    await context.close();
  });
}
