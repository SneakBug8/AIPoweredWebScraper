
//US6 Scraper uses AI to extract key fields from the scraped pages

import { GroqAPI } from "../api/groq";
import { MessageWrapper } from "../MessageWrapper";
import { shuffleArray } from "../util/shuffeArray";
import { Sleep } from "../util/Sleep";
import { CarPostingRecordRepository, CarPostingRecord } from "./CarPostingRecord";
import { ScrapedPageRecord, ScrapedPageRecordRepository } from "../scraper/ScrapedPage";
import { ConvertAllToMd, RunFullScraping } from "../scraper/ScraperService";
import { KentavarSource, AutoBgSource } from "../scraper/ScrapeSource";
import * as fs from "fs";
import * as path from "path";

function reply(msg: MessageWrapper, text: string) {
  msg.reply(text);
}

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
      posting.MIS_DT = record.LAST_FETCHED;
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

  shuffleArray(records);

  for (const record of records) {
    console.log(`Extracting fields from ${path.basename(record.URL)}`);
    const contents = fs.readFileSync(record.mdfilepath as string).toString();

    try {
      await Promise.all([ExtractFields(record, contents), Sleep(30000)]);
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
        await Promise.all([ExtractFields(record, contents, "openai/gpt-oss-120b"), Sleep(30000)]);
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
export async function ProcessCarScraper(message: MessageWrapper) {
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
    RunFullScraping(KentavarSource);
    return true;
  }
  else if (message.checkRegex(/\/scrape_autobg/)) {
    RunFullScraping(AutoBgSource);
    return true;
  }
  // US4AC1 /convert_to_md command converts all fetched html files
  else if (message.checkRegex(/\/convert_to_md/)) {
    //US4AC2 Conversion is done async to the main bot flow
    ConvertAllToMd();
    return true;
  }
  else if (message.checkRegex(/\/extract_fields/)) {
    //US6AC2 Field extraction is done async to the main bot flow
    ExtractAllFields(message);
    return true;
  }
  return false;
}
