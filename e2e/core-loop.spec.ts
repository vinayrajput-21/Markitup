import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { seedUser, cleanupUsers } from "./seed";

// Unique per run so re-runs never collide on the `profiles.email` unique
// constraint and so cleanup only ever targets this run's rows.
const stamp = Date.now();
const owner = { email: `owner${stamp}@example.com`, password: "password123", name: "Owner" };
const client = { email: `client${stamp}@example.com`, password: "password123", name: "Client" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app");
}

test.describe("core loop", () => {
  // Seed both users directly in the DB (already email_confirmed) instead of
  // signing up through the UI: this cloud project has email confirmation ON,
  // so a UI signup returns no session and would try (and fail) to send a
  // real confirmation email to a fake test address.
  test.beforeAll(async () => {
    await seedUser(owner.email, owner.password, owner.name);
    await seedUser(client.email, client.password, client.name);
  });

  // Playwright always runs afterAll hooks after the test file finishes,
  // whether the test(s) passed or failed, so this cleanup runs unconditionally.
  test.afterAll(async () => {
    try {
      await cleanupUsers([owner.email, client.email]);
    } finally {
      // no-op: guarantees the cleanup attempt above is not swallowed by a
      // later failure being added to this hook.
    }
  });

  test("owner runs the full core loop", async ({ page }) => {
    // 1. Login as owner -> lands on /app (workspace auto-bootstrapped on
    // first authenticated load, see app/app/actions.ts#getCurrentWorkspace).
    await login(page, owner.email, owner.password);
    await expect(page).toHaveURL(/\/app$/);

    // 2. Create a project and open it.
    await page.fill('input[name="name"]', "Homepage");
    await page.click('button:has-text("Create")');
    await page.click("text=Homepage");
    await page.waitForURL("**/app/projects/**");

    // 3. Upload a mockup image (real upload to Supabase Storage).
    await page.setInputFiles('input[type="file"]', path.join(__dirname, "fixtures/sample.png"));
    await expect(page.locator("text=sample.png")).toBeVisible({ timeout: 20_000 });

    // 4. Add the client as a workspace member.
    await page.goto("/app/members");
    await page.fill('input[name="email"]', client.email);
    await page.click('button:has-text("Add")');
    await expect(page.locator("li", { hasText: client.name })).toBeVisible({ timeout: 10_000 });

    // 5. Open the mockup, drop a pin, and add a comment.
    await page.goto("/app");
    await page.click("text=Homepage");
    await page.click("text=sample.png");
    const img = page.locator("img[alt='mockup']");
    await expect(img).toBeVisible({ timeout: 20_000 });
    await img.click();
    await expect(page.locator("text=Pin #1")).toBeVisible();
    await page.fill("textarea", "Please fix the header");
    await page.click('button:has-text("Comment")');
    await expect(page.locator("text=Please fix the header")).toBeVisible();

    // 6. Resolve the pin and verify the active/all filter behavior.
    await page.click('button:has-text("Mark resolved")');
    await page.click('button:has-text("active")');
    await expect(page.locator("button:has-text('1')")).toHaveCount(0);
    await page.click('button:has-text("all")');
    await expect(page.locator("button:has-text('1')")).toBeVisible();
  });
});
