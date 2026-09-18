import { Page } from "playwright";
import { Sleep } from "./Sleep";

// Page state relevant for Cloudflare challenge detection (pure data, unit-testable).
export interface CloudflareChallengeState {
    title: string;
    bodyText: string;
    responseStatus: number | undefined;
}

// Pure detection logic: decides whether the given page state is a Cloudflare
// challenge ("Just a moment..." / "Checking your browser" interstitial).
export function IsCloudflareChallengeState(state: CloudflareChallengeState): boolean {
    const title = (state.title || "").toLowerCase();
    if (title.includes("just a moment") || title.includes("checking your browser")) {
        return true;
    }

    if (state.responseStatus === 403) {
        const body = (state.bodyText || "").toLowerCase();
        return body.includes("just a moment")
            || body.includes("verify you are human")
            || body.includes("enable javascript");
    }

    return false;
}

// Loads the current page state from the real browser page.
async function ReadCloudflareChallengeState(page: Page): Promise<CloudflareChallengeState> {
    return await page.evaluate(() => {
        const nav = window.performance.getEntriesByType("navigation")[0] as (PerformanceResourceTiming & { responseStatus?: number }) | undefined;
        return {
            title: document.title || "",
            bodyText: document.body?.innerText || "",
            responseStatus: nav?.responseStatus,
        };
    });
}

// Detects whether the loaded page is a Cloudflare challenge
// ("Just a moment..." / "Checking your browser" interstitial).
export async function IsCloudflareChallenge(page: Page): Promise<boolean> {
    try {
        return IsCloudflareChallengeState(await ReadCloudflareChallengeState(page));
    }
    catch (e) {
        // Navigation may be in progress (challenge redirect), so treat it like a resolved page
        return false;
    }
}

// Waits until the Cloudflare challenge disappears.
// The challenge can be passed automatically, or solved manually by the user in the browser.
// The loop is intentional and unlimited: it introduces an artificial delay
// only while the check is present, and otherwise returns immediately.
export async function WaitForCloudflareToResolve(page: Page, pollIntervalMs: number = 10000): Promise<void> {
    let waited = 0;

    while (await IsCloudflareChallenge(page)) {
        waited += pollIntervalMs;
        console.log(`[Cloudflare] Challenge still present, waiting for it to resolve (${(waited / 1000).toFixed(0)}s elapsed)`);
        await Sleep(pollIntervalMs);
    }
}