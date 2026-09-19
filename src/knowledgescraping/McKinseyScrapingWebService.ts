import { WebApi } from "../api/web.js";
import { IsBotAvailable } from "../api/bot.js";
import * as express from "express";
import { McKinseyInsightsSource } from "../scraper/ScrapeSource.js";
import { RunFullScraping, ConvertAllToMd } from "../scraper/ScraperService.js";
import { ScrapedPageRecordRepository } from "../scraper/ScrapedPage.js";
import { IndustryFactRepository } from "./IndustryFactRecord.js";
import { ExtractAllIndustryFacts, IsMcKinseyExtractionBusy } from "./McKinseyScrapingService.js";

// Web UI for McKinsey fact scraping: a dedicated dashboard with its own action buttons,
// independent from the IIBA article workflow. Follows the same PRG+flash pattern.
// US9AC6 The web dashboard lists the extracted facts with region and qualifier
class McKinseyScrapingWebServiceClass {
    public async Init() {
        WebApi.app.get("/knowledge/mckinsey", this.OnDashboard.bind(this));
        WebApi.app.post("/knowledge/mckinsey/scrape", this.OnScrape.bind(this));
        WebApi.app.post("/knowledge/mckinsey/convert", this.OnConvert.bind(this));
        WebApi.app.post("/knowledge/mckinsey/extract", this.OnExtract.bind(this));
    }

    private ApplyFlashes(req: express.Request, context: any = {}) {
        const flashes = req.flash();
        if (Array.isArray(flashes["error"]) && flashes["error"].length && !context.error) {
            context.error = flashes["error"][flashes["error"].length - 1];
        }
        if (Array.isArray(flashes["success"]) && flashes["success"].length && !context.message) {
            context.message = flashes["success"][flashes["success"].length - 1];
        }
        return context;
    }

    public async OnDashboard(req: express.Request, res: express.Response) {
        const context = this.ApplyFlashes(req);
        context.system = await this.GetSystemStats();
        context.db = await this.GetDbStats();
        context.latestFacts = await IndustryFactRepository.GetLatest(20);
        return res.render("knowledge/mckinsey", context);
    }

    private async GetSystemStats() {
        return {
            botAvailable: IsBotAvailable(),
            sourceBusy: McKinseyInsightsSource.isBusy,
            extractionBusy: IsMcKinseyExtractionBusy(),
        };
    }

    private async GetDbStats() {
        return {
            facts: await IndustryFactRepository.Count(),
            scrapedPages: await ScrapedPageRecordRepository.Count(),
            scrapeQueue: (await ScrapedPageRecordRepository.GetScrapingQueueURLs([McKinseyInsightsSource.categoryUrl, ...McKinseyInsightsSource.initialURLs])).length,
            mdQueue: (await ScrapedPageRecordRepository.GetMDExtractionQueue()).length,
            fieldQueue: (await ScrapedPageRecordRepository.GetFieldExtractionQueue()).length,
        };
    }

    private async OnScrape(req: express.Request, res: express.Response) {
        if (McKinseyInsightsSource.isBusy) {
            req.flash("error", "McKinsey scraping is already in progress");
            return res.redirect("/knowledge/mckinsey");
        }

        RunFullScraping(McKinseyInsightsSource);
        req.flash("success", "McKinsey scraping started.");
        return res.redirect("/knowledge/mckinsey");
    }

    private async OnConvert(req: express.Request, res: express.Response) {
        ConvertAllToMd();
        req.flash("success", "Markdown conversion started.");
        return res.redirect("/knowledge/mckinsey");
    }

    private async OnExtract(req: express.Request, res: express.Response) {
        if (IsMcKinseyExtractionBusy()) {
            req.flash("error", "Fact extraction is already in progress");
            return res.redirect("/knowledge/mckinsey");
        }

        ExtractAllIndustryFacts();
        req.flash("success", "Fact extraction started.");
        return res.redirect("/knowledge/mckinsey");
    }
}

export const McKinseyScrapingWebService = new McKinseyScrapingWebServiceClass();