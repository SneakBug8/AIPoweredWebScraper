import { WebApi } from "../api/web.js";
import { IsBotAvailable } from "../api/bot.js";
import * as express from "express";
import { ApartmentCianSource } from "../scraper/ScrapeSource.js";
import { RunFullScraping } from "../scraper/ScraperService.js";
import { ScrapedPageRecordRepository } from "../scraper/ScrapedPage.js";
import { ApartmentPosting, ApartmentPostingRepository } from "./ApartmentPostingRecord.js";
import { ExtractAllFields, IsFieldExtractionBusy } from "./ApartmentPostingService.js";

// Web UI for CIAN apartment scraping: a single dashboard that shows system/DB stats and
// exposes two buttons to run the CIAN scraper and the LLM field extractor. Mirrors the
// PRG+flash pattern used by DiscordSuggestionWebService and keeps Telegram optional.
class ApartmentPostingWebServiceClass {
    public async Init() {
        WebApi.app.get("/apartments", this.OnDashboard.bind(this));
        WebApi.app.post("/apartments/scrape", this.OnScrape.bind(this));
        WebApi.app.post("/apartments/extract", this.OnExtract.bind(this));
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
        context.latestPostings = await ApartmentPostingRepository.GetLatest(20);
        return res.render("apartments/apartments", context);
    }

    private async GetSystemStats() {
        return {
            botAvailable: IsBotAvailable(),
            sourceBusy: ApartmentCianSource.isBusy,
            extractionBusy: IsFieldExtractionBusy(),
        };
    }

    private async GetDbStats() {
        return {
            scrapedPages: await ScrapedPageRecordRepository.Count(),
            scrapeQueue: (await ScrapedPageRecordRepository.GetScrapingQueueURLs([ApartmentCianSource.categoryUrl, ...ApartmentCianSource.initialURLs])).length,
            mdQueue: (await ScrapedPageRecordRepository.GetMDExtractionQueue()).length,
            fieldQueue: (await ScrapedPageRecordRepository.GetFieldExtractionQueue()).length,
            postings: await ApartmentPostingRepository.Count(),
        };
    }

    private async OnScrape(req: express.Request, res: express.Response) {
        if (ApartmentCianSource.isBusy) {
            req.flash("error", "CIAN scraping is already in progress");
            return res.redirect("/apartments");
        }

        RunFullScraping(ApartmentCianSource);
        req.flash("success", "CIAN scraping started.");
        return res.redirect("/apartments");
    }

    private async OnExtract(req: express.Request, res: express.Response) {
        if (IsFieldExtractionBusy()) {
            req.flash("error", "Field extraction is already in progress");
            return res.redirect("/apartments");
        }

        ExtractAllFields();
        req.flash("success", "Field extraction started.");
        return res.redirect("/apartments");
    }
}

export const ApartmentPostingWebService = new ApartmentPostingWebServiceClass();