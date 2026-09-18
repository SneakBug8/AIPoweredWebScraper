import { WebApi } from "../api/web.js";
import { IsBotAvailable } from "../api/bot.js";
import * as express from "express";
import { KentavarSource, AutoBgSource } from "../scraper/ScrapeSource.js";
import { RunFullScraping, ConvertAllToMd } from "../scraper/ScraperService.js";
import { ScrapedPageRecordRepository } from "../scraper/ScrapedPage.js";
import { CarPostingRecord, CarPostingRecordRepository } from "./CarPostingRecord.js";
import { ExtractAllFields, IsFieldExtractionBusy } from "./CarPostingService.js";

// Web UI for car scrape sources (Kentavar, AutoBG): a single dashboard that shows system/DB
// stats and exposes buttons to run the source scrapers, the MD converter and the LLM field
// extractor. Mirrors the PRG+flash pattern used by ApartmentPostingWebService.
class CarPostingWebServiceClass {
    public async Init() {
        WebApi.app.get("/cars", this.OnDashboard.bind(this));
        WebApi.app.post("/cars/scrape_kentavar", this.OnScrapeKentavar.bind(this));
        WebApi.app.post("/cars/scrape_autobg", this.OnScrapeAutoBg.bind(this));
        WebApi.app.post("/cars/convert_to_md", this.OnConvertToMd.bind(this));
        WebApi.app.post("/cars/extract", this.OnExtract.bind(this));
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

    private carSourceFilters() {
        const filters = [];
        for (const source of [KentavarSource, AutoBgSource]) {
            filters.push(source.categoryUrl, ...source.initialURLs);
        }
        return filters;
    }

    public async OnDashboard(req: express.Request, res: express.Response) {
        const context = this.ApplyFlashes(req);
        context.system = await this.GetSystemStats();
        context.db = await this.GetDbStats();
        context.latestPostings = await CarPostingRecordRepository.GetLatest(20);
        return res.render("cars/cars", context);
    }

    private async GetSystemStats() {
        return {
            botAvailable: IsBotAvailable(),
            kentavarBusy: KentavarSource.isBusy,
            autoBgBusy: AutoBgSource.isBusy,
            extractionBusy: IsFieldExtractionBusy(),
        };
    }

    private async GetDbStats() {
        return {
            scrapedPages: await ScrapedPageRecordRepository.Count(),
            scrapeQueue: (await ScrapedPageRecordRepository.GetScrapingQueueURLs(this.carSourceFilters())).length,
            mdQueue: (await ScrapedPageRecordRepository.GetMDExtractionQueue()).length,
            fieldQueue: (await ScrapedPageRecordRepository.GetFieldExtractionQueue()).length,
            postings: await CarPostingRecordRepository.Count(),
        };
    }

    private async OnScrapeKentavar(req: express.Request, res: express.Response) {
        if (KentavarSource.isBusy) {
            req.flash("error", "Kentavar scraping is already in progress");
            return res.redirect("/cars");
        }

        RunFullScraping(KentavarSource);
        req.flash("success", "Kentavar scraping started.");
        return res.redirect("/cars");
    }

    private async OnScrapeAutoBg(req: express.Request, res: express.Response) {
        if (AutoBgSource.isBusy) {
            req.flash("error", "AutoBG scraping is already in progress");
            return res.redirect("/cars");
        }

        RunFullScraping(AutoBgSource);
        req.flash("success", "AutoBG scraping started.");
        return res.redirect("/cars");
    }

    private async OnConvertToMd(req: express.Request, res: express.Response) {
        ConvertAllToMd();
        req.flash("success", "Markdown conversion started.");
        return res.redirect("/cars");
    }

    private async OnExtract(req: express.Request, res: express.Response) {
        if (IsFieldExtractionBusy()) {
            req.flash("error", "Field extraction is already in progress");
            return res.redirect("/cars");
        }

        ExtractAllFields();
        req.flash("success", "Field extraction started.");
        return res.redirect("/cars");
    }
}

export const CarPostingWebService = new CarPostingWebServiceClass();