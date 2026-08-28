import { MessageWrapper } from "../MessageWrapper";
import { MIS_DT } from "../util/MIS_DT";
import { Config } from "../config";
import { Builder, Browser, By, WebDriver } from 'selenium-webdriver';
import { Sleep } from "../util/Sleep";
import * as fs from "fs";
import * as path from "path";
import TurndownService from 'turndown';
import { ScrapedPageRecord, ScrapedPageRecordRepository } from "./ScrapedPage";
import { ScrapeSource } from "./ScrapeSource";
import { shuffleArray } from "../util/shuffeArray";
import { TgBotServer } from "../App";

let driver: WebDriver = null as any;

// Create driver when the bot starts
(async () => {
  driver = new Builder().forBrowser(Browser.FIREFOX).build()
  await driver.manage().setTimeouts({
    implicit: 10_000, // element lookup timeout
    pageLoad: 60_000, // page-load timeout
    script: 30_000    // executeAsyncScript timeout
  });
})();

// US2 The scraper does scraping autonomously

async function ScrapePage(driver: WebDriver, url: string, source: ScrapeSource) {
  // US2AC5 The scraper waits for the page to load and applies artificial delay to scraping
  // US2AC10 The scraper repeats tries to open the page until it is succesful
  let hasEncounteredError = "No content"; // must resolve to true to enter cycle
  let i = 0;
  // US40AC20 The scraper tries to open the page for 5 times before returning the error
  while (hasEncounteredError && i < 5) {
    try {
      console.log(`Opening page ${url}, try ${i}`);
      driver.get(url);
      await Sleep(1250);
      hasEncounteredError = "";
      await Promise.race([driver.get(url), async () => { await Sleep(10000); hasEncounteredError = "Page load timeout" }]);
      await Sleep(1000);
    }
    catch (e) {
      i++;
      // console.error(`Caught error when opening the page`, e);
      hasEncounteredError = JSON.stringify(e);
      await Sleep(3000);
    }
  }
  if (hasEncounteredError) {
    throw new Error("Error opening the page: " + hasEncounteredError);
  }

  // US2AC13 When the page returns 404 Not Found, it is skipped and its record deleted
  try {
    const statusCode = await driver.executeScript(
      "return window.performance.getEntriesByType('navigation')[0].responseStatus;"
    ) as number;

    if (statusCode === 404) {
      console.log(`Page ${url} returned 404 Not Found, removing from scraping`);

      //const existing_record = await ScrapedPageRecordRepository.GetWithURL(url);
      //if (existing_record) {
      //  await ScrapedPageRecordRepository.Delete(existing_record);
      //  console.log(`Deleted scraped page record for ${url}`);
      //}

      return null;
    }
    else if (statusCode !== 200) {
      console.log(`Page ${url} returned ${statusCode} code, skipping`);
      return null;
    }
  }
  catch (e) {
    console.error("Caught error when checking page status code", e);
  }

  // US2AC14 The scraper scrolls the page down to trigger infinite loading until its height stops changing
  try {
    const maxScrollIterations = 25; // Safety cap against pages that never stop growing
    let previousHeight = await driver.executeScript("return document.body.scrollHeight") as number;
    let iterations = 0;

    while (iterations < maxScrollIterations) {
      await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
      await Sleep(1000);

      const currentHeight = await driver.executeScript("return document.body.scrollHeight") as number;
      iterations++;

      if (currentHeight <= previousHeight) {
        break;
      }

      console.log(`Page ${url} lazy-loaded more content | height ${previousHeight} -> ${currentHeight} | try ${iterations}`);
      previousHeight = currentHeight;
    }
  }
  catch (e) {
    console.error("Caught error when triggering infinite loading", e);
  }

  // US2AC7 The scraper adds a[href] links on the page to the queue
  // US3 The scraper filters links it finds to narrow down search
  // US3AC1 The scraper follows the link only if it is part of the categoryUrl (base url) or initial URL
  // Scrape links before we delete them below to avoid stale elements being referenced
  try {
    const URLsQueuePrev = (await ScrapedPageRecordRepository.GetScrapingQueueURLs()).length;

    for (const element of await driver.findElements(By.css('a'))) {
      const href1 = await element.getAttribute("href");
      if (!href1)
        continue;
      const href2 = href1.split("#")[0]; // Remove unwanted link clutter
      const href = href2.split("?")[0];

      if (href.endsWith(".pdf")) {
        continue;
      }

      if (href &&
        (href.includes(source.categoryUrl) || urlInArrayPartial(href, source.initialURLs))
        && !href.includes("sms:") && !href.includes("tel:")
        && !href.includes("viber:") && !href.includes("about:")) {
        const link_in_the_db = await ScrapedPageRecordRepository.GetWithURL(href);

        // console.log("Found link on the page", href, "visited:", !!link_in_the_db);

        if (!link_in_the_db) {
          // Save new link to the DB
          const linked_page_record = new ScrapedPageRecord();
          linked_page_record.URL = href;
          await ScrapedPageRecordRepository.Insert(linked_page_record);
        }
      }
    }

    const URLsQueueNext = (await ScrapedPageRecordRepository.GetScrapingQueueURLs()).length;
    console.log(`Added ${URLsQueueNext - URLsQueuePrev} new links to the DB and scraping queue`);
  }
  catch (e) {
    console.error("Caught error when appending URLs queue", e);
  }

  url = url.replace(/\/+$/, "");

  const pagepieces = url.split("/");
  const pagename = pagepieces[pagepieces.length - 1]
    .replace(/\?/g, "-")
    .replace(/\./g, "-")
    .replace(/=/g, "-") || await driver.getTitle();

  // Add page to the scraped URLs even if the body element wasn't found to prevent repeated scraping of fluff pages
  const existing_record = await ScrapedPageRecordRepository.GetWithURL(url);
  let record = new ScrapedPageRecord();
  if (existing_record) {
    record = existing_record;
    record.LAST_FETCHED = MIS_DT.GetExact();
    await ScrapedPageRecordRepository.Update(record);
  }
  else {
    record.URL = url;
    record.LAST_FETCHED = MIS_DT.GetExact();
    record = await ScrapedPageRecordRepository.Insert(record);
  }

  // Preliminary exit for pages that aren't saved
  if (!url.includes(source.categoryUrl) || !await source.filter(driver)) {
    return record;
  }

  // US5 The scraper removes some unwanted elements from the page
  // There is no point in removing elements from pages that aren't saved such as initial URLs or list pages
  try {
    let removedElements = 0;
    for (const selector of source.unwantedElementsSelectors) {
      const script = `
        var selector = arguments[0];
        var elements = document.querySelectorAll(selector);
        var count = 0;
        for (var i = elements.length - 1; i >= 0; i--) {   // reverse loop avoids index shifting
          var el = elements[i];
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
            count++;
          }
        }
        return count;
      `;
      const removed = await driver.executeScript(script, selector) as number;
      removedElements += removed;
    }

    // Remove empty spans filled with icons and other crap
    await driver.executeScript(() => {
      document.querySelectorAll("span").forEach(span => {
        if (!span.textContent || span.textContent.trim() === "") {
          span.remove();
        }
      });
    });
  }
  catch (e) {
    console.error("Caught error when removing clutter from the page", e);
  }

  // US4AC9 The scraper saves only pages matching category URL
  try {
    // US4AC1 To remove clutter, the scraper saves only meaningful part of the page
    const pagehtmlpath = path.resolve(Config.dataPath(), source.folderName + "/" + pagename + ".html");

    let bodyElFound = false;
    // US4AC10 The scraper tries to find the most precise root element of the page
    for (const bodyElSelector of source.rootElementSelectors) {
      const allMatchingElements = await driver.findElements(By.css(bodyElSelector));
      if (!allMatchingElements.length)
        continue;

      bodyElFound = true;
      const bodyel = allMatchingElements[0];

      fs.writeFileSync(pagehtmlpath, await bodyel.getAttribute("innerHTML"));
      // console.log("Saved HTML contents to drive");

      //US2AC11 Scraper maintains metadata records in the database to link URLs with outputted files
      const existing_record = record || await ScrapedPageRecordRepository.GetWithURL(url);
      if (existing_record) {
        existing_record.LAST_FETCHED = MIS_DT.GetExact();
        existing_record.htmlfilepath = pagehtmlpath;
        existing_record.mdfilepath = null;
        await ScrapedPageRecordRepository.Update(existing_record);
      }
      else {
        const new_page_record = new ScrapedPageRecord();
        new_page_record.URL = url;
        new_page_record.LAST_FETCHED = MIS_DT.GetExact();
        new_page_record.htmlfilepath = pagehtmlpath;
        record = await ScrapedPageRecordRepository.Insert(new_page_record);
      }
      break;
    }

    if (!bodyElFound) {
      console.log("Body element not found, skipping");
    }
  }
  catch (e) {
    console.error("Caught error when saving the page contents", e);
  }

  return record;
}

// US1AC3 Scraping is done async to bot operations
export async function RunFullScraping(source: ScrapeSource) {
  await Sleep(1000);

  // US2AC15 The scraper doesn't process a single source more than once simultaneously
  if (source.isBusy) {
    TgBotServer.SendMessage(`Source ${source.folderName} is already processed`);
    return;
  }
  source.isBusy = true;

  const ScrapedURLsPrev = (await ScrapedPageRecordRepository.GetRecentlyScrapedURLs()).length;
  const URLsQueuePrev = (await ScrapedPageRecordRepository.GetScrapingQueueURLs()).length;

  console.log(`Starting scraping |`, ScrapedURLsPrev, " URLs scraped recently |", URLsQueuePrev, " URLs in queue");

  try {
    // US2AC2 The scraper maintains a queue of URLs to scrape in the DB
    let URLsQueue = [...source.initialURLs];

    //US2AC8 The scraper continues scraping until the queue is empty
    while (URLsQueue.length) {
      // US2AC1 The scraper maintains a list of already scraped URLs in the DB
      const ScrapedURLs = await ScrapedPageRecordRepository.GetRecentlyScrapedURLs();

      // US2AC9 The scraper shuffles the queue to cover more pages with unfinished scrapes
      //shuffleArray(URLsQueue);
      const url = URLsQueue[URLsQueue.length - 1];
      URLsQueue.pop();

      if (!url)
        continue;

      // US2AC4 If URL to scrape has already been scraped and it's not one of the initial URLs, the scraper ignores it
      if (ScrapedURLs.includes(url) && URLsQueue.length > 0 && !source.initialURLs.includes(url)) {
        console.log(`Skipping already visited page ${url}`);
        continue;
      }

      console.log(`Scraping `, url, " | ", ScrapedURLs.length, " URLs scraped recently |", URLsQueue.length, " URLs in queue");

      await Promise.all([await ScrapePage(driver, url, source), await Sleep(source.minInterval + getRandomInt(15000))]);

      // US2AC12 The scraper visits only pages w/o html file scraped or visited long ago
      // US3AC1 Only pages of the currently scraped source are processed
      // Merge new queue from the DB with cached queue without duplicates
      if (!URLsQueue.length) URLsQueue = new Array(...new Set([...URLsQueue, ...await ScrapedPageRecordRepository.GetScrapingQueueURLs([source.categoryUrl, ...source.initialURLs])]));
    }
    //US2AC3 Since the scraper stores all its state in the DB, it is fully resumeable with almost no overhead (it always visits the initial page first)

    if (!URLsQueue.length)
      console.log("No more pages in queue");
  }
  catch (e) {
    console.error(e);
  }
  finally {
    source.isBusy = false;
  }

  const ScrapedURLsNew = (await ScrapedPageRecordRepository.GetRecentlyScrapedURLs()).length;
  TgBotServer.SendMessage(`Scraped ${ScrapedURLsNew - ScrapedURLsPrev} pages today`);
}

// US4 The scraper extracts markdown files for processing
async function ExtractMarkdown(pagehtmlpath: string, markdownpath: string) {
  const contents = fs.readFileSync(pagehtmlpath).toString();

  //const res = convert(contents);
  var turndownService = new TurndownService();
  var markdown = turndownService.turndown(contents);

  fs.writeFileSync(markdownpath, markdown);
}

export async function ConvertAllToMd() {
  let count = 0;

  for (const record of await ScrapedPageRecordRepository.GetMDExtractionQueue()) {
    if (!record.htmlfilepath || record.mdfilepath)
      continue;

    const markdownpath = path.resolve(Config.dataPath(), "md/" + MIS_DT.SortableFormat(MIS_DT.GetExact()) + "_" + path.basename(record.htmlfilepath) + ".md");
    await ExtractMarkdown(record.htmlfilepath, markdownpath);
    count++;

    record.mdfilepath = markdownpath;
    await ScrapedPageRecordRepository.Update(record);
  }

  TgBotServer.SendMessage(`Converted ${count} files to Markdown`);
}

function urlInArrayPartial(href: string, array: string[]) {
  for (const a of array) {
    if (href.includes(a))
      return true;
  }
  return false;
}


function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}