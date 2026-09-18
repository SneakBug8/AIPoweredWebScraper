import { assert } from "chai";
import {
    IsCloudflareChallengeState,
    IsCloudflareChallenge,
    WaitForCloudflareToResolve,
} from "../util/Cloudflare";
import { Page } from "playwright";

describe('Cloudflare', function () {
    describe('IsCloudflareChallengeState (pure detection)', function () {
        it('detects a challenge by title "Just a moment..."', function () {
            assert.equal(IsCloudflareChallengeState({ title: "Just a moment...", bodyText: "", responseStatus: 403 }), true);
        });

        it('detects a challenge by title "Checking your browser"', function () {
            assert.equal(IsCloudflareChallengeState({ title: "Checking your browser before accessing...", bodyText: "", responseStatus: 403 }), true);
        });

        it('detects a challenge by 403 response and body "Just a moment"', function () {
            assert.equal(IsCloudflareChallengeState({ title: "", bodyText: "Just a moment...", responseStatus: 403 }), true);
        });

        it('detects a challenge by body "verify you are human"', function () {
            assert.equal(IsCloudflareChallengeState({ title: "", bodyText: "Verify you are human", responseStatus: 403 }), true);
        });

        it('detects a challenge by body "enable javascript"', function () {
            assert.equal(IsCloudflareChallengeState({ title: "", bodyText: "Enable JavaScript and cookies to continue", responseStatus: 403 }), true);
        });

        it('is case-insensitive', function () {
            assert.equal(IsCloudflareChallengeState({ title: "JUST A MOMENT...", bodyText: "", responseStatus: 403 }), true);
        });

        it('does not flag a normal page with 200 status', function () {
            assert.equal(IsCloudflareChallengeState({ title: "Example Domain", bodyText: "Example Domain", responseStatus: 200 }), false);
        });

        it('does not flag an empty page', function () {
            assert.equal(IsCloudflareChallengeState({ title: "", bodyText: "", responseStatus: undefined }), false);
        });

        it('does not flag a 403 page without challenge markers', function () {
            assert.equal(IsCloudflareChallengeState({ title: "Forbidden", bodyText: "Access denied", responseStatus: 403 }), false);
        });
    });

    describe('IsCloudflareChallenge (browser page wrapper)', function () {
        it('returns false when the page evaluate throws (navigation in progress)', async function () {
            const brokenPage = {
                evaluate: async () => { throw new Error("Execution context destroyed"); },
            } as unknown as Page;
            assert.equal(await IsCloudflareChallenge(brokenPage), false);
        });
    });

    describe('WaitForCloudflareToResolve', function () {
        it('returns immediately when there is no challenge', async function () {
            const plainPage = {
                evaluate: async () => ({ title: "Example Domain", bodyText: "Example Domain", responseStatus: 200 }),
            } as unknown as Page;

            const start = Date.now();
            await WaitForCloudflareToResolve(plainPage, 10);
            const elapsed = Date.now() - start;

            assert.isBelow(elapsed, 50, "should not wait when no challenge is present");
        });

        it('ignores subsequent checks once the challenge is gone', async function () {
            let check = 0;
            const flippingPage = {
                evaluate: async () => {
                    check++;
                    if (check === 1) {
                        return { title: "Just a moment...", bodyText: "", responseStatus: 403 };
                    }
                    return { title: "Example Domain", bodyText: "Example Domain", responseStatus: 200 };
                },
            } as unknown as Page;

            const start = Date.now();
            await WaitForCloudflareToResolve(flippingPage, 10);
            const elapsed = Date.now() - start;

            assert.isAtLeast(check, 2, "should re-check until the challenge disappears");
            assert.isAtLeast(elapsed, 10, "should poll at least once while the challenge is present");
        });
    });
});