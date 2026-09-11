// Proof on the real browser surface: sign up, save prefs, watch the match
// board populate, and open the alert outbox. Screenshots land in
// artifacts/. Target defaults to the Convex-site-served SPA.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.SITE_URL ?? "http://127.0.0.1:3211";
mkdirSync("artifacts", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const email = `ui-${Date.now()}@example.com`;

await page.goto(base);
await page.waitForSelector("text=Whisker Watch");
await page.screenshot({ path: "artifacts/1-signin.png" });

await page.click("text=New here? Create an account");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "hunter2hunter2");
await page.click('button[type="submit"]');
await page.waitForSelector("text=Your watch", { timeout: 15000 });
console.log("signed up and reached the watch form");

await page.fill('input[type="email"]', email);
await page.fill('input[pattern]', "94103");
const chip = (label) => page.locator(".chip", { hasText: label });
await chip("long").click();
await chip("kitten").click();
await chip("young").click();
await page.click('button[type="submit"]');
await page.waitForSelector("text=Saved ✓");
console.log("prefs saved");

await page.waitForSelector(".match", { timeout: 30000 });
const names = await page.locator(".match-body a").allTextContents();
console.log("match board populated without refresh:", names);
await page.screenshot({ path: "artifacts/2-board.png", fullPage: true });

await page.waitForSelector("text=Alert outbox", { timeout: 30000 });
await page.locator(".alert summary").first().click();
await page.screenshot({ path: "artifacts/3-outbox.png", fullPage: true });
console.log("outbox visible with sent alert");

await page.reload();
await page.waitForSelector("text=Your watch");
const zip = await page.inputValue("input[pattern]");
const coatOn = await page.locator(".chip.on", { hasText: "long" }).count();
if (zip !== "94103" || coatOn !== 1) throw new Error("prefs did not survive reload");
console.log("prefs survived a full page reload");
await browser.close();
console.log("VERIFY UI: PASS");
