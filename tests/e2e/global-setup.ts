import { chromium, type FullConfig } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@logistasolutions.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

const USERS = [
  { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, path: "tests/.auth/admin.json" },
];

/**
 * Sign each test user in once and save their session to disk so individual
 * tests can load them via `browser.newContext({ storageState })`.
 *
 * Admin is the default storageState in playwright.config. Add more users
 * (operator, receiving_tech, client_portal_user) to the USERS array as
 * tests start needing role-specific contexts.
 */
export default async function globalSetup(config: FullConfig) {
  if (!ADMIN_PASSWORD) {
    throw new Error(
      "TEST_ADMIN_PASSWORD is not set in .env.local. See tests/README.md."
    );
  }

  const baseURL =
    config.projects[0]?.use?.baseURL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    "http://localhost:3000";

  const browser = await chromium.launch();

  for (const user of USERS) {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${baseURL}/login`);
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 15_000,
    });

    await context.storageState({ path: user.path });
    await context.close();
  }

  await browser.close();
}
