import { WebApi } from "../api/web.js";
import { IsBotAvailable } from "../api/bot.js";
import * as express from "express";
import { KnowledgeIIBASource } from "../scraper/ScrapeSource.js";
import { RunFullScraping } from "../scraper/ScraperService.js";
import { ScrapedPageRecordRepository } from "../scraper/ScrapedPage.js";
import { KnowledgeArticle, KnowledgeArticleRepository } from "./KnowledgeArticleRecord.js";
import { ExtractAllArticles, IsKnowledgeExtractionBusy } from "./KnowledgeScrapingService.js";

// Web UI for knowledge article scraping: a single dashboard that shows system/DB stats and
// exposes two buttons to run the knowledge scraper and the LLM article extractor. Mirrors the
// PRG+flash pattern used by ApartmentPostingWebService and keeps Telegram optional.
class KnowledgeScrapingWebServiceClass {
    public async Init() {
        WebApi.app.get("/knowledge", this.OnDashboard.bind(this));
        WebApi.app.post("/knowledge/scrape", this.OnScrape.bind(this));
        WebApi.app.post("/knowledge/extract", this.OnExtract.bind(this));
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
        context.latestArticles = await KnowledgeArticleRepository.GetLatest(20);
        return res.render("knowledge/knowledge", context);
    }

    private async GetSystemStats() {
        return {
            botAvailable: IsBotAvailable(),
            sourceBusy: KnowledgeIIBASource.isBusy,
            extractionBusy: IsKnowledgeExtractionBusy(),
        };
    }

    private async GetDbStats() {
        return {
            articles: await KnowledgeArticleRepository.Count(),
            scrapedPages: await ScrapedPageRecordRepository.Count(),
            scrapeQueue: (await ScrapedPageRecordRepository.GetScrapingQueueURLs([KnowledgeIIBASource.categoryUrl, ...KnowledgeIIBASource.initialURLs])).length,
            mdQueue: (await ScrapedPageRecordRepository.GetMDExtractionQueue()).length,
            fieldQueue: (await ScrapedPageRecordRepository.GetFieldExtractionQueue()).length,
        };
    }

    private async OnScrape(req: express.Request, res: express.Response) {
        if (KnowledgeIIBASource.isBusy) {
            req.flash("error", "Knowledge scraping is already in progress");
            return res.redirect("/knowledge");
        }

        RunFullScraping(KnowledgeIIBASource);
        req.flash("success", "Knowledge scraping started.");
        return res.redirect("/knowledge");
    }

    private async OnExtract(req: express.Request, res: express.Response) {
        if (IsKnowledgeExtractionBusy()) {
            req.flash("error", "Article extraction is already in progress");
            return res.redirect("/knowledge");
        }

        ExtractAllArticles();
        req.flash("success", "Article extraction started.");
        return res.redirect("/knowledge");
    }
}

export const KnowledgeScrapingWebService = new KnowledgeScrapingWebServiceClass();