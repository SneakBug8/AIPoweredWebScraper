import { MessageWrapper } from "../MessageWrapper";
import { ScrapedPageRecord, ScrapedPageRecordRepository } from "../scraper/ScrapedPage";
import { RunFullScraping } from "../scraper/ScraperService";
import { McKinseyInsightsSource } from "../scraper/ScrapeSource";
import * as fs from "fs";
import { IndustryFact, IndustryFactRepository } from "./IndustryFactRecord";
import { Sleep } from "../util/Sleep";
import { BalancedAIRequestWTools } from "../assistant/ModelUseBalancer";

const McKinseyInsightsContentKeywords = ["report", "article", "blog post", "charts", "case study"];

// US9 The scraper extracts numerical reference data facts from McKinsey Insights pages and stores them as IndustryFacts
export async function ProcessMcKinseyScraping(message: MessageWrapper) {
    if (message.checkRegex(/\/scrape_mckinsey/)) {
        console.log(`[McKinseyScrapingService] Command /scrape_mckinsey received, starting full scraping of ${McKinseyInsightsSource.categoryUrl}`);
        RunFullScraping(McKinseyInsightsSource);
        return true;
    }
    else if (message.checkRegex(/\/extract_mckinsey/)) {
        //US9AC4 Fact extraction is done async to the main bot flow
        console.log(`[McKinseyScrapingService] Command /extract_mckinsey received, launching facts extraction`);
        ExtractAllIndustryFacts(message);
        return true;
    }
    return false;
}

// US9AC5 The extraction prompt requires an explicit figure and preserves value, unit, region, qualifier, and date
const IndustryFactsSystemPrompt =
    "You extract numerical reference data facts from McKinsey Insights articles. " +
    "A fact is valid only when it contains at least one concrete figure: an absolute number (for example 12 million, 450,000), " +
    "a percentage (for example 35%), a monetary amount (for example $1.2 trillion, €8 billion), " +
    "a growth rate (for example 9 percent per year), a ratio (for example 1 in 3, 60% of respondents), " +
    "or a count (for example 2,000 companies, 850 respondents).\n" +
    "For every figure, output one fact object with the following fields:\n" +
    "1. topic — the industry or subject domain (for example Banking, Generative AI, Global trade, Healthcare, Supply chains).\n" +
    "2. metric — the quantity that the figure measures (for example market size, revenue share, adoption rate, cost reduction, jobs created).\n" +
    "3. value — the figure exactly as the article prints it, including its unit and scale word (for example $1.2 trillion, 35%, 12.5 million).\n" +
    "4. region — the geographic scope of the figure (for example Global, United States, Europe, Asia-Pacific, Middle East). Use 'Global' when the article states a worldwide scope.\n" +
    "5. qualifier — the precision word attached to the figure (for example approximately, about, more than, at least, up to, nearly, exactly). Use an empty string when none is present.\n" +
    "6. fact — one complete, self-contained sentence that states the figure and its context.\n" +
    "7. date — the year or the specific date the figure refers to (for example 2024, 2030, 2023-2027, 2025-03-10). Use the survey year or the stated reference year. Use an empty string when the article gives no time reference.\n" +
    "Rules:\n" +
    "- Extract a figure only when the article states it explicitly. Never compute, convert, round, or infer a value.\n" +
    "- Emit one fact object per figure. When a sentence contains several figures, emit several fact objects.\n" +
    "- Keep the original number, its scale word, and its unit unchanged.\n" +
    "- Keep the projection year in the date field so that projections stay distinguishable from current figures.\n" +
    "- Include the survey sample when the article reports it (for example a survey of 1,000 executives).\n" +
    "- Skip figures that appear only in the reading time, the publication date, the author bio, subscription offers, and navigation or related-content blocks.\n" +
    "- Return an empty facts array when the page contains no concrete figures.";

async function ExtractIndustryFacts(record: ScrapedPageRecord, content: string) {
    const url = record.URL;
    const lowerContent = content.toLowerCase();

    // US9AC1 The scraper keeps only pages of the relevant content type
    if (!McKinseyInsightsContentKeywords.some((kw) => lowerContent.includes(kw))) {
        return;
    }

    if (lowerContent.includes("page not found")) {
        return;
    }

    //US9AC2 The scraper skips pages whose facts are already stored from the same source
    const existing_facts = await IndustryFactRepository.GetWithSource(url);
    if (existing_facts.length) {
        return;
    }

    const messages = [
        { role: 'system', content: IndustryFactsSystemPrompt },
        { role: 'user', content: content },
    ];

    const chatCompletion = await BalancedAIRequestWTools(messages, [], {
        "type": "json_schema",
        "json_schema": {
            "name": "industry_fact",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "facts": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "topic": { "type": "string", "description": "Industry or subject domain." },
                                "metric": { "type": "string", "description": "The quantity that is measured." },
                                "value": { "type": "string", "description": "The exact figure with its unit and scale." },
                                "region": { "type": "string", "description": "Geographic scope: Global, United States, Europe, Asia-Pacific, etc." },
                                "qualifier": { "type": "string", "description": "Precision word: approximately, at least, up to, etc. Empty when none." },
                                "fact": { "type": "string", "description": "A complete self-contained sentence with the figure." },
                                "date": { "type": "string", "description": "YYYY-MM-DD, YYYY, or YYYY-YYYY that the figure refers to." }
                            },
                            "required": ["topic", "metric", "value", "region", "qualifier", "fact", "date"],
                            "additionalProperties": false
                        }
                    }
                },
                "required": ["facts"],
                "additionalProperties": false
            }
        }
    });

    const root = JSON.parse(chatCompletion.getContent() || '{"facts": []}');
    const facts = Array.isArray(root?.facts) ? root.facts : [];

    if (!facts.length) {
        return;
    }

    //US9AC3 The scraper inserts new facts it found in the DB
    for (const elem of facts) {
        const fact = new IndustryFact();
        fact.topic = elem?.topic ?? "";
        fact.metric = elem?.metric ?? "";
        fact.value = elem?.value ?? "";
        fact.region = elem?.region ?? "";
        fact.qualifier = elem?.qualifier ?? "";
        fact.fact = elem?.fact ?? "";
        fact.date = elem?.date ?? "";
        fact.source = url;
        await IndustryFactRepository.Insert(fact);
    }
}

let ServiceBusy = false;

export function IsMcKinseyExtractionBusy() {
    return ServiceBusy;
}

function Report(text: string, message?: MessageWrapper) {
    console.log(`[McKinseyScrapingService] ${text}`);
    if (message) {
        message.reply(text);
    }
}

export async function ExtractAllIndustryFacts(message?: MessageWrapper) {
    let count = 0;

    if (ServiceBusy) {
        Report("Fact extraction already in progress", message);
        return;
    }

    ServiceBusy = true;
    console.log(`[McKinseyScrapingService] ExtractAllIndustryFacts started, ServiceBusy=${ServiceBusy}`);

    const records = await ScrapedPageRecordRepository.GetFieldExtractionQueue();
    // Only McKinsey-related sources are allowed (slash-strip both sides so trailing-slash URLs still match)
    const filteredEntries = records.filter((entry) => entry.URL.replace(/\/+$/, "").includes(McKinseyInsightsSource.categoryUrl.replace(/\/+$/, "")));

    const skipCount = records.length - filteredEntries.length;
    console.log(`[McKinseyScrapingService] Field extraction queue: ${records.length} records, McKinsey-related: ${filteredEntries.length}, skipped (other sources): ${skipCount}`);

    for (const entry of filteredEntries) {
        console.log(`[McKinseyScrapingService] Processing record (${count + 1}/${filteredEntries.length}): ${entry.URL} | md: ${entry.mdfilepath}`);
        if (!entry.mdfilepath) {
            console.log(`[McKinseyScrapingService] SKIP: ${entry.URL} has no mdfilepath`);
            continue;
        }
        const contents = fs.readFileSync(entry.mdfilepath as string).toString();
        console.log(`[McKinseyScrapingService] Read ${contents.length} chars from ${entry.mdfilepath}`);

        try {
            await Promise.all([ExtractIndustryFacts(entry, contents), Sleep(30000)]);
            count++;
            console.log(`[McKinseyScrapingService] SUCCESS: extracted facts from ${entry.URL}, total count=${count}`);
            entry.mdfilepath = null;
            await ScrapedPageRecordRepository.Update(entry);
            console.log(`[McKinseyScrapingService] Cleared mdfilepath for ${entry.URL}`);
        }
        catch (e) {
            console.error(`[McKinseyScrapingService] FAILED to extract facts from ${entry.URL}:`, e);
            await Sleep(30000);
            continue;
        }
    }

    ServiceBusy = false;
    console.log(`[McKinseyScrapingService] ExtractAllIndustryFacts finished, processed ${count} files, ServiceBusy=${ServiceBusy}`);
    Report(`Extracted industry facts from ${count} Markdown files`, message);
}