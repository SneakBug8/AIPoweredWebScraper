import { MessageWrapper } from "../MessageWrapper";
import { ScrapedPageRecord, ScrapedPageRecordRepository } from "../scraper/ScrapedPage";
import { RunFullScraping } from "../scraper/ScraperService";
import { KnowledgeIIBASource, ScrapeSource } from "../scraper/ScrapeSource";
import * as fs from "fs";
import { KnowledgeArticle, KnowledgeArticleRepository } from "./KnowledgeArticleRecord";
import { Sleep } from "../util/Sleep";
import { BalancedAIRequestWTools } from "../assistant/ModelUseBalancer";
import { TgBotServer } from "../App";

// Knowledge sources are reused from ScrapeSource.ts to keep the scraping logic centralized
const KnowledgeSources: ScrapeSource[] = [
    KnowledgeIIBASource,
];

//US8 Scraper scrapes knowledge articles
export async function ProcessKnowledgeScraping(message: MessageWrapper) {
    if (message.checkRegex(/\/scrape_knowledge/)) {
        console.log(`[KnowledgeScrapingService] Command /scrape_knowledge received, starting full scraping of ${KnowledgeIIBASource.categoryUrl}`);
        RunFullScraping(KnowledgeIIBASource);
        return true;
    }
    else if (message.checkRegex(/\/extract_knowledge/)) {
        //US8AC5 Field extraction is done async to the main bot flow
        console.log(`[KnowledgeScrapingService] Command /extract_knowledge received, launching article extraction`);
        ExtractAllArticles(message);
        return true;
    }
    return false;
}

async function ExtractArticleFields(record: ScrapedPageRecord, content: string) {
    const url = record.URL;
    console.log(`[KnowledgeScrapingService] ExtractArticleFields started for ${url}`);
    console.log(`[KnowledgeScrapingService] Markdown content length: ${content.length} chars, md file: ${record.mdfilepath}`);

    // US8AC1 The scraper filters out not found pages
    if (content.toLowerCase().includes("page not found")) {
        console.log(`[KnowledgeScrapingService] SKIP: ${url} contains "page not found"`);
        return;
    }

    const messages = [
        { role: 'system', content: "Extract the article metadata from the business analysis blog page. Take title, author, summary and publication date." },
        { role: 'user', content: content },
    ];

    const chatCompletion = await BalancedAIRequestWTools(
        messages, [], {
        "type": "json_schema",
        "json_schema": {
            "name": "knowledge_article",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "is_article_page": { "type": "boolean" },
                    "title": { "type": "string" },
                    "author": { "type": "string" },
                    "summary": { "type": "string" },
                    "published": { "type": "string" },
                },
                "required": ["is_article_page", "title", "author", "summary", "published"],
                "additionalProperties": false
            }
        }
    });

    const fields = JSON.parse(chatCompletion.getContent() || "{}");
    console.log(`[KnowledgeScrapingService] AI response for ${url}: ${chatCompletion.getContent()}`);

    if (!fields.is_article_page) {
        console.log(`[KnowledgeScrapingService] SKIP: ${url} is not an article page per AI`);
        return;
    }
    console.log(`[KnowledgeScrapingService] AI classified ${url} as an article page`);

    //US8AC3 Scraper inserts new articles it found in the DB
    //US8AC4 Scraper updates articles coming from the same source
    const existing_record = await KnowledgeArticleRepository.GetWithSource(url);
    if (existing_record) {
        console.log(`[KnowledgeScrapingService] Article ${url} exists in DB (Id=${existing_record.Id}), updating it`);
        existing_record.title = fields?.title;
        existing_record.author = fields?.author;
        existing_record.summary = fields?.summary;
        existing_record.published = fields?.published;
        existing_record.contentMd = content;
        existing_record.source = url;
        await KnowledgeArticleRepository.Update(existing_record);
        console.log(`[KnowledgeScrapingService] Updated knowledge article "${existing_record.title}" (Id=${existing_record.Id})`);
    }
    else {
        console.log(`[KnowledgeScrapingService] Article ${url} is new, creating it`);
        const article = new KnowledgeArticle();
        article.title = fields?.title;
        article.author = fields?.author;
        article.summary = fields?.summary;
        article.published = fields?.published;
        article.contentMd = content;

        //US8AC10 Scraper adds shop that the article was found from
        article.shop = "IIBA";
        article.source = url;
        article.MIS_DT = record.LAST_FETCHED;
        await KnowledgeArticleRepository.Insert(article);
        console.log(`[KnowledgeScrapingService] Created knowledge article "${article.title}" (Id=${article.Id})`);

        //US8AC11 When a new article is found, the scraper notifies the user with a clickable link
        TgBotServer.SendMessage(`📚 New article: ${article.title}\nSource: ${article.shop}\n[Open](${url})`);

        return { isNewArticle: true };
    }

    return { isNewArticle: false };
}

let ServiceBusy = false;

export function IsKnowledgeExtractionBusy() {
    return ServiceBusy;
}

function Report(text: string, message?: MessageWrapper) {
    console.log(`[KnowledgeScrapingService] ${text}`);
    if (message) {
        message.reply(text);
    }
}

export async function ExtractAllArticles(message?: MessageWrapper) {
    let count = 0;

    if (ServiceBusy) {
        Report("Article extraction already in progress", message);
        return;
    }

    ServiceBusy = true;
    console.log(`[KnowledgeScrapingService] ExtractAllArticles started, ServiceBusy=${ServiceBusy}`);

    const records = await ScrapedPageRecordRepository.GetFieldExtractionQueue();
    // Only knowledge-related sources are allowed (slash-strip both sides so trailing-slash URLs still match)
    const filteredEntries = records.filter((entry) => KnowledgeSources.some((filter) => entry.URL.replace(/\/+$/, "").includes(filter.categoryUrl.replace(/\/+$/, ""))));

    const skipCount = records.length - filteredEntries.length;
    console.log(`[KnowledgeScrapingService] Field extraction queue: ${records.length} records, knowledge-related: ${filteredEntries.length}, skipped (other sources): ${skipCount}`);
    for (const entry of filteredEntries) {
        console.log(`[KnowledgeScrapingService] Queued record: ${entry.URL} | md: ${entry.mdfilepath}`);
    }

    console.log(`[KnowledgeScrapingService] Began extracting fields from`, filteredEntries.length, " queued pages.");

    count += await ProcessRecords(filteredEntries);

    ServiceBusy = false;
    console.log(`[KnowledgeScrapingService] ExtractAllArticles finished, processed ${count} files, ServiceBusy=${ServiceBusy}`);
    Report(`Extracted fields from ${count} Markdown files`, message);
}

// Stop extracting once we have discovered enough new articles
const MaxNewArticlesBeforeStop = 10;

async function ProcessRecords(records: ScrapedPageRecord[]) {
    let count = 0;
    let newArticles = 0;
    console.log(`[KnowledgeScrapingService] ProcessRecords started, ${records.length} records to process`);
    for (const record of records) {
        if (newArticles >= MaxNewArticlesBeforeStop) {
            console.log(`[KnowledgeScrapingService] STOP: reached ${MaxNewArticlesBeforeStop} new articles, exiting extraction early`);
            break;
        }
        console.log(`[KnowledgeScrapingService] Processing record (${count + 1}/${records.length}): ${record.URL} | md: ${record.mdfilepath}`);
        if (!record.mdfilepath) {
            console.log(`[KnowledgeScrapingService] SKIP: ${record.URL} has no mdfilepath`);
            continue;
        }
        const contents = fs.readFileSync(record.mdfilepath as string).toString();
        console.log(`[KnowledgeScrapingService] Read ${contents.length} chars from ${record.mdfilepath}`);

        try {
            const result = await Promise.all([ExtractArticleFields(record, contents), Sleep(30000)]);
            count++;
            if (result[0]?.isNewArticle) {
                newArticles++;
                console.log(`[KnowledgeScrapingService] New articles so far: ${newArticles}/${MaxNewArticlesBeforeStop}`);
            }
            console.log(`[KnowledgeScrapingService] SUCCESS: extracted article from ${record.URL}, total count=${count}`);
            // US8AC6 After successfully extracting fields, the scraper deletes the MD file path
            // fs.unlinkSync(record.mdfilepath);
            record.mdfilepath = null;
            await ScrapedPageRecordRepository.Update(record);
            console.log(`[KnowledgeScrapingService] Cleared mdfilepath for ${record.URL}`);
        }
        catch (e) {
            console.error(`[KnowledgeScrapingService] FAILED to extract article from ${record.URL}:`, e);
            await Sleep(30000);
            continue;
        }
    }
    console.log(`[KnowledgeScrapingService] ProcessRecords finished, total count=${count}, new articles=${newArticles}`);
    return count;
}