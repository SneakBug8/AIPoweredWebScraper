import { MessageWrapper } from "../MessageWrapper";
import { MIS_DT } from "../util/MIS_DT";
import { Config } from "../config";
import { Builder, Browser, By, WebDriver } from 'selenium-webdriver';
import { Sleep } from "../util/Sleep";
import * as fs from "fs";
import * as path from "path";
import TurndownService from 'turndown';
import { GroqAPI } from "../api/groq";
import { CarPostingRecord, CarPostingRecordRepository } from "./CarPostingRecord";
import { ScrapedPageRecord, ScrapedPageRecordRepository } from "./ScrapedPage";
import { AutoBgSource, KentavarSource, ScrapeSource } from "./ScrapeSource";

let driver: WebDriver = null as any;

// Create driver when the bot starts
(async () => {
  driver = new Builder().forBrowser(Browser.FIREFOX).build()
})();

function reply(msg: MessageWrapper, text: string) {
  msg.reply(text);
}

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
      await Sleep(1500);
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

  // US4 The scraper saves the html of the page to the filesystem
  const pagepieces = url.split("/");
  const pagename = pagepieces[pagepieces.length - 1].replace("?", "-").replace(".", "-").replace("=", "-"); //await driver.getTitle();

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
        (href.includes(source.categoryUrl) || href.includes(source.initialUrl))
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

  // US5 The scraper removes some unwanted elements from the page
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
  }
  catch (e) {
    console.error("Caught error when removing clutter from the page", e);
  }

  // US4AC9 The scraper saves only pages matching category URL
  try {
    if (url.includes(source.categoryUrl)) {
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
  }
  catch (e) {
    console.error("Caught error when saving the page contents", e);
  }

  return record;
}

// US1AC3 Scraping is done async to bot operations
async function RunFullScraping(message: MessageWrapper, source: ScrapeSource) {
  await Sleep(1000);

  const ScrapedURLsPrev = (await ScrapedPageRecordRepository.GetRecentlyScrapedURLs()).length;
  const URLsQueuePrev = (await ScrapedPageRecordRepository.GetScrapingQueueURLs()).length;

  console.log(`Starting scraping |`, ScrapedURLsPrev, " URLs scraped recently |", URLsQueuePrev, " URLs in queue");

  try {
    // US2AC2 The scraper maintains a queue of URLs to scrape in the DB
    let URLsQueue = [source.initialUrl];

    //US2AC8 The scraper continues scraping until the queue is empty
    while (URLsQueue.length) {
      // US2AC1 The scraper maintains a list of already scraped URLs in the DB
      const ScrapedURLs = await ScrapedPageRecordRepository.GetRecentlyScrapedURLs();

      // US2AC9 The scraper shuffles the queue to cover more pages with unfinished scrapes
      shuffle(URLsQueue);
      const url = URLsQueue[URLsQueue.length - 1];
      URLsQueue.pop();

      if (!url)
        continue;

      // US2AC4 If URL to scrape has already been scraped, the scraper ignores it
      if (ScrapedURLs.includes(url) && URLsQueue.length > 0) {
        console.log(`Skipping already visited page ${url}`);
        continue;
      }

      await Promise.all([await ScrapePage(driver, url, source), await Sleep(1000 + getRandomInt(15000))]);

      // US2AC12 The scraper visits only pages w/o html file scraped or visited long ago
      // US3AC1 Only pages of the currently scraped source are processed
      URLsQueue = await ScrapedPageRecordRepository.GetScrapingQueueURLs([source.categoryUrl, source.initialUrl]);
    }
    //US2AC3 Since the scraper stores all its state in the DB, it is fully resumeable with almost no overhead (it always visits the initial page first)

    if (!URLsQueue.length)
      console.log("No more pages in queue");
  }
  catch (e) {
    console.error(e);
  }

  const ScrapedURLsNew = (await ScrapedPageRecordRepository.GetRecentlyScrapedURLs()).length;
  reply(message, `Scraped ${ScrapedURLsNew - ScrapedURLsPrev} pages today`);
}

// US4 The scraper extracts markdown files for processing
async function ExtractMarkdown(pagehtmlpath: string, markdownpath: string) {
  const contents = fs.readFileSync(pagehtmlpath).toString();

  //const res = convert(contents);
  var turndownService = new TurndownService();
  var markdown = turndownService.turndown(contents);

  fs.writeFileSync(markdownpath, markdown);
}

async function ConvertAllToMd(message: MessageWrapper) {
  let count = 0;

  for (const record of await ScrapedPageRecordRepository.GetMDExtractionQueue()) {
    if (!record.htmlfilepath || record.mdfilepath)
      continue;

    const markdownpath = path.resolve(Config.dataPath(), "md/" + path.basename(record.htmlfilepath) + ".md");
    await ExtractMarkdown(record.htmlfilepath, markdownpath);
    count++;

    record.mdfilepath = markdownpath;
    await ScrapedPageRecordRepository.Update(record);
  }

  reply(message, `Converted ${count} files to Markdown`);
}

//US6 Scraper uses AI to extract key fields from the scraped pages

async function ExtractFields(record: ScrapedPageRecord, content: string, model = 'openai/gpt-oss-20b') {
  // Filter out non-single car pages
  const url = record.URL;

  // US4AC1 Inlude only pages of relevant type
  if (!content.toLowerCase().includes("цена"))
    return;

  if (content.toLowerCase().includes("page not found"))
    return;

  const messages = [
    { role: 'system', content: "Extract fields from the car sale posting. Take price in EUR." },
    { role: 'user', content: content },
  ];

  await Sleep(30000);

  //US6AC1 Scraper extracts car brand, model, production year, mileage, and price
  const chatCompletion = await GroqAPI.chat.completions.create({
    messages: messages as any,
    model: model,
    response_format: {
      "type": "json_schema",
      "json_schema": {
        "name": "car_sale_posting",
        "strict": true,
        "schema": {
          "type": "object",
          "properties": {
            "is_single_car_page": { "type": "boolean" },
            "car_brand": { "type": "string" },
            "model": { "type": "string" },
            "year_of_production": { "type": "number" },
            "mileage": { "type": "number" },
            "price": { "type": "number" },
            "is_automatic_transmission_type": { "type": "boolean" },
          },
          "required": ["is_single_car_page", "car_brand", "model", "year_of_production", "mileage", "price", "is_automatic_transmission_type"],
          "additionalProperties": false
        }
      }
    }
  });

  console.log(chatCompletion.id);

  for (const choice of chatCompletion.choices) {
    const fields = JSON.parse(choice.message.content || "{}");
    console.log(choice.message.content);

    if (!fields.is_single_car_page)
      return;
    if (fields.price < 1002)
      return; // Must be a mistake or a car sold for parts

    //US6AC3 Scraper inserts new postings it found in the DB
    //US6AC4 Scraper updates postings coming from the same source
    const existing_record = await CarPostingRecordRepository.GetWithSource(url);
    if (existing_record) {
      existing_record.car_brand = fields?.car_brand;
      existing_record.model = fields?.model;
      existing_record.year_of_production = fields?.year_of_production;
      existing_record.mileage = fields?.mileage;
      existing_record.price = fields?.price;
      existing_record.is_automatic_transmission_type = fields?.is_automatic_transmission_type;
      existing_record.source = url;
      await CarPostingRecordRepository.Update(existing_record);
      console.log(`Updated car posting for ${existing_record.car_brand} ${existing_record.model} ${existing_record.year_of_production}.`);
    }
    else {
      const posting = new CarPostingRecord();
      posting.car_brand = fields?.car_brand;
      posting.model = fields?.model;
      posting.year_of_production = fields?.year_of_production;
      posting.mileage = fields?.mileage;
      posting.price = fields?.price;
      posting.is_automatic_transmission_type = fields?.is_automatic_transmission_type;
      //US6AC2 Scraper adds shop that the posting was found from
      posting.source = url;
      await CarPostingRecordRepository.Insert(posting);
      console.log(`Created new car posting for ${posting.car_brand} ${posting.model} ${posting.year_of_production}.`);
    }

    return choice.message.content;
  }
}

async function ExtractAllFields(message: MessageWrapper) {

  let count = 0;

  const records = await ScrapedPageRecordRepository.GetFieldExtractionQueue();

  console.log(`Began extracting fields from`, records.length, " queued pages.");

  shuffle(records);

  for (const record of records) {
    console.log(`Extracting fields from ${path.basename(record.URL)}`);
    const contents = fs.readFileSync(record.mdfilepath as string).toString();

    try {
      await Promise.all([ExtractFields(record, contents), Sleep(5000)]);
      count++;
      // US6AC6 After successfully extracting fields, the scraper deletes MD file and mdfilepath
      // fs.unlinkSync(record.mdfilepath);
      record.mdfilepath = null;
      await ScrapedPageRecordRepository.Update(record);
    }
    catch (e) {
      console.log("Switching to openai/gpt-oss-120b model for reliability");
      //US6AC5 Scraper switches between two suitable models if error occurs
      try {
        await Promise.all([ExtractFields(record, contents, "openai/gpt-oss-120b"), Sleep(5000)]);
      }
      catch (e) {
        console.error("Caught error when extracting fields", e);
        break;
      }
    }
  }

  reply(message, `Extracted fields from ${count} Markdown files`);
}

// US1 User initiates scraping with /scrape command
export async function ProcessScraper(message: MessageWrapper) {
  if (message.checkRegex(/\/status/)) {
    const q1 = await ScrapedPageRecordRepository.GetRecentlyScrapedURLs();
    const q2 = await ScrapedPageRecordRepository.GetScrapingQueueURLs();
    const q3 = await ScrapedPageRecordRepository.GetMDExtractionQueue();
    const q4 = await ScrapedPageRecordRepository.GetFieldExtractionQueue();
    const q5 = await CarPostingRecordRepository.GetAll();

    console.log("Recently scraped:", q1.length,
      "HTML Scraping Queue:", q2.length,
      "MD extraction queue:", q3.length,
      "Field Extraction Queue:", q4.length,
      "Car Postings collected:", q5.length);
    message.reply(
      `Recently scraped: ${q1.length}
      HTML Scraping Queue: ${q2.length}
      MD extraction queue: ${q3.length}
      Field Extraction Queue: ${q4.length}
      Car Postings collected: ${q5.length}`
    )
    return true;
  }
  else if (message.checkRegex(/\/scrape_kentavar/)) {
    RunFullScraping(message, KentavarSource);
    return true;
  }
  else if (message.checkRegex(/\/scrape_autobg/)) {
    RunFullScraping(message, AutoBgSource);
    return true;
  }
  // US4AC1 /convert_to_md command converts all fetched html files
  else if (message.checkRegex(/\/convert_to_md/)) {
    //US4AC2 Conversion is done async to the main bot flow
    ConvertAllToMd(message);
    return true;
  }
  else if (message.checkRegex(/\/extract_fields/)) {
    //US6AC2 Field extraction is done async to the main bot flow
    ExtractAllFields(message);
    return true;
  }
  return false;
}

function shuffle(array: Array<any>) {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}