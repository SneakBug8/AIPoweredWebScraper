import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { Config } from "../config.js";
import { MIS_DT } from "../util/MIS_DT.js";
import { Sleep } from "../util/Sleep.js";

// ----------------------------------------------------------------------
// Shared Playwright browser for all web tools (web_search, wikipedia, visit_website).
//
// Parallel-safety model: a single chromium Browser process is shared, but EVERY fetch
// gets its own isolated BrowserContext (fresh cookies) and Page. This keeps requests
// independent and parallel-safe, unlike the previous single Selenium driver which had
// to be serialized with a global lock.
// ----------------------------------------------------------------------

let browser: Browser | null = null;
let browserLockPromise: Promise<void> | null = null;

// Serialize the lazy launch so concurrent first requests don't launch twice.
export async function getBrowser(): Promise<Browser> {
    if (browser && browser.isConnected()) {
        return browser;
    }
    if (!browserLockPromise) {
        browserLockPromise = (async () => {
            if (browser && browser.isConnected()) {
                return;
            }
            try {
                if (browser) {
                    await browser.close().catch(() => { });
                }
            } catch (e) { /* ignore */ }
            browser = await chromium.launch({ headless: Config.isProduction() });
            console.log("[PlaywrightBrowser] Chromium launched");
        })().finally(() => { browserLockPromise = null; });
    }
    await browserLockPromise;
    if (!browser) {
        throw new Error("PlaywrightBrowser: failed to launch chromium");
    }
    return browser;
}

function rejectOnTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Page load timed out after ${ms}ms`)), ms)
    );
}

const NAVIGATION_TIMEOUT_MS = 60000;

// ----------------------------------------------------------------------
// DOM cleanup helpers (ported from the old Selenium implementation)
// ----------------------------------------------------------------------
const REMOVE_ELEMENTS_SCRIPT = `
(selector) => {
  var elements = document.querySelectorAll(selector);
  var count = 0;
  for (var i = elements.length - 1; i >= 0; i--) {
    var el = elements[i];
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
      count++;
    }
  }
  return count;
}
`;

const REMOVE_STRUCK_THROUGH_SCRIPT = `
() => {
  const elements = document.querySelectorAll('*');
  let count = 0;
  for (let el of elements) {
    const dec = window.getComputedStyle(el).textDecoration;
    if (dec.includes('line-through') && el && el.parentNode) {
      el.parentNode.removeChild(el);
      count++;
    }
  }
  return count;
}
`;

// Fetches a page and writes the (cleaned) innerHTML of the first root element into
// htmlfilepath. Mirrors the contract of the old Selenium FetchPageWSelenium.
export async function FetchPagePlaywright(url: string, rootElementSelectors: string[], unwantedElementsSelectors: string[], htmlfilepath: string): Promise<void> {
    const b = await getBrowser();
    // Fresh, isolated context per request -> parallel-safe, no cross-request cookies.
    const context: BrowserContext = await b.newContext({ userAgent: undefined });
    const page: Page = await context.newPage();

    try {
        // Navigate with retries, mirroring the old 3-attempt loop.
        let hasEncounteredError = "No content";
        let i = 0;
        while (hasEncounteredError && i < 3) {
            try {
                console.log(`[PlaywrightBrowser] Opening page ${url}, try ${i}`);
                hasEncounteredError = "";
                try {
                    await Promise.race([
                        page.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS }),
                        rejectOnTimeout(NAVIGATION_TIMEOUT_MS),
                    ]);
                } catch (e: any) {
                    // Some pages never settle on "load"/"networkidle"; domcontentloaded + a short
                    // settle wait is more tolerant. Treat slow loads as a retryable failure.
                    hasEncounteredError = JSON.stringify(e);
                    await Sleep(1500);
                    continue;
                }
                // Let dynamic content settle briefly before extracting.
                await Sleep(1000);
            }
            catch (e) {
                i++;
                hasEncounteredError = JSON.stringify(e);
                await Sleep(2500);
            }
            finally {
                i++;
            }
        }
        if (hasEncounteredError) {
            throw new Error("Error opening the page: " + hasEncounteredError);
        }

        // Remove unwanted elements.
        try {
            for (const selector of unwantedElementsSelectors) {
                await page.evaluate(REMOVE_ELEMENTS_SCRIPT, selector);
                await page.evaluate(REMOVE_STRUCK_THROUGH_SCRIPT);
            }
        }
        catch (e) {
            console.error("[PlaywrightBrowser] Caught error when removing clutter from the page", e);
        }

        // Save the most precise root element found.
        let bodyElFound = false;
        for (const bodyElSelector of rootElementSelectors) {
            const allMatchingElements = await page.locator(bodyElSelector).all();
            if (!allMatchingElements.length) continue;
            bodyElFound = true;
            const innerHTML = await allMatchingElements[0].innerHTML();
            // Commit the page only after the body element content is captured.
            fs.writeFileSync(htmlfilepath, innerHTML);
            // Save a copy for debugging.
            try {
                const mainurl = url.split("?")[0];
                const pagepieces = mainurl.split("/");
                const pagename = pagepieces[pagepieces.length - 1].replace("?", "-").replace(".", "-").replace("=", "-");
                const pagehtmlpath = path.resolve(Config.dataPath(), "fetchedwebpages/" + MIS_DT.GetExact().toString() + "-" + pagename + ".html");
                fs.writeFileSync(pagehtmlpath, innerHTML);
            }
            catch (e) {
                console.error("[PlaywrightBrowser] Couldn't save page copy for debugging");
            }
            break;
        }
        if (!bodyElFound) {
            console.log("[PlaywrightBrowser] Body element not found, skipping");
        }
    }
    finally {
        // Always close the per-request context (also closes its page).
        await context.close().catch(() => { });
    }
}

// Closes the shared browser (e.g. on shutdown).
export async function ClosePlaywrightBrowser(): Promise<void> {
    if (browser) {
        await browser.close().catch(() => { });
        browser = null;
    }
}
