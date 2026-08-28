import { GroqAPI } from "../api/groq";
import { MessageWrapper } from "../MessageWrapper";
import { ScrapedPageRecord, ScrapedPageRecordRepository } from "../scraper/ScrapedPage";
import { RunFullScraping } from "../scraper/ScraperService";
import { ApartmentCianSource } from "../scraper/ScrapeSource";
import * as fs from "fs";
import * as path from "path";
import { ApartmentPosting, ApartmentPostingRepository } from "./ApartmentPostingRecord";
import { Sleep } from "../util/Sleep";
import { Config } from "../config";

const workspacePath = path.resolve(Config.basePath(), "../workspace");
const identityFile = fs.readFileSync(path.resolve(workspacePath, "APARTMENTSPROMPT.md"));
const AgentIdentity = identityFile.toString();

//US7 Scraper scrapes apartment postings and extracts fields
export async function ProcessApartmentPostings(message: MessageWrapper) {
  if (message.checkRegex(/\/scrape_cian/)) {
    RunFullScraping(ApartmentCianSource);
    return true;
  }
  else if (message.checkRegex(/\/extract_apartments/)) {
    //US7AC5 Field extraction is done async to the main bot flow
    ExtractAllFields(message);
    return true;
  }
  return false;
}

async function ExtractFields(record: ScrapedPageRecord, content: string, model = 'openai/gpt-oss-20b') {
  // Filter out non-single car pages
  const url = record.URL;

  // US7AC1 The scraper filters out pages without the price
  if (!content.toLowerCase().includes("цена") && !content.toLowerCase().includes("цены"))
    return;

  // US7AC2 The scraper filters out not found pages
  if (content.toLowerCase().includes("page not found") || content.toLowerCase().includes("не найдено"))
    return;

  const messages = [
    { role: 'system', content: AgentIdentity },
    { role: 'user', content: content },
  ];

  //US6AC1 Scraper extracts car brand, model, production year, mileage, and price
  const chatCompletion = await GroqAPI.chat.completions.create({
    messages: messages as any,
    model: model,
    response_format: {
      "type": "json_schema",
      "json_schema": {
        "name": "apartment_sale_posting",
        "strict": true,
        "schema": {
          "type": "object",
          "properties": {
            "subwayStation": { "type": "string", "description": "Ближайшая станция метро к квартире. Не шоссе. Не расстояние от МКАД. Полное официальное название станции метро." },
            "subwayDistance": { "type": "number", "description": "Расстояние в минутах до ближайшей станции метро из поля subwayStation." },
            "transportAvailabiity": { "type": "number", "description": "Общая оценка транспортной доступности от 1 до 10." },
            "type": { "type": "string", "description": "Тип жилья, выведенный на странице. Например, 'новостройка' или 'вторичка'." },
            "year_of_construction": { "type": "number", "description": "Поле года постройки здания. Если на странице отсутствует - верни 0." },
            "area": { "type": "number", "description": "Общая площадь квартиры в квадратных метрах (выведена в заголовке) без дробной части, запятых, пробелов и единиц измерения." },
            "price": { "type": "number", "description": "Общая цена квартиры в рублях цифрой без знака рубля, без запятых и пробелов." },
          },
          "required": ["subwayStation", "subwayDistance", "transportAvailabiity", "type", "year_of_construction", "area", "price"],
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

    //US7AC3 Scraper inserts new postings it found in the DB
    //US7AC4 Scraper updates postings coming from the same source
    const existing_record = await ApartmentPostingRepository.GetWithSource(url);
    if (existing_record) {
      existing_record.subwayStation = fields?.subwayStation;
      existing_record.subwayDistance = fields?.subwayDistance;
      existing_record.transportAvailabiity = fields?.transportAvailabiity;
      existing_record.type = fields?.type;
      existing_record.year_of_construction = fields?.year_of_construction;
      existing_record.area = fields?.area;
      existing_record.price = fields?.price;
      existing_record.source = url;
      await ApartmentPostingRepository.Update(existing_record);
      console.log(`Updated car posting for ${existing_record.type} ${existing_record.area}m2 selling for ${existing_record.price}`);
    }
    else {
      const posting = new ApartmentPosting();
      posting.subwayStation = fields?.subwayStation;
      posting.subwayDistance = fields?.subwayDistance;
      posting.transportAvailabiity = fields?.transportAvailabiity;
      posting.type = fields?.type;
      posting.price = fields?.price;
      posting.year_of_construction = fields?.year_of_construction;
      posting.area = fields?.area;

      //US7AC10 Scraper adds shop that the posting was found from
      posting.source = url;
      posting.MIS_DT = record.LAST_FETCHED;
      await ApartmentPostingRepository.Insert(posting);
      console.log(`Created new apartment posting for ${posting.type} ${posting.area}m2 selling for ${posting.price}`);
    }

    return choice.message.content;
  }
}

let ServiceBusy = false;

async function ExtractAllFields(message: MessageWrapper) {

  let count = 0;

  if (ServiceBusy) {
    message.reply("Field extraction already in progress");
    return;
  }

  ServiceBusy = true;

  const sources = [ApartmentCianSource];

  const records = await ScrapedPageRecordRepository.GetFieldExtractionQueue();
  // Only car-related sources are allowed
  const filteredEntries = records.filter((entry) => sources.some((filter) => entry.URL.includes(filter.categoryUrl)));

  console.log(`Began extracting fields from`, filteredEntries.length, " queued pages.");

  for (const record of filteredEntries) {
    console.log(`Extracting fields from ${path.basename(record.URL)}`);
    const contents = fs.readFileSync(record.mdfilepath as string).toString();

    try {
      await Promise.all([ExtractFields(record, contents), Sleep(30000)]);
      count++;
      // US7AC6 After successfully extracting fields, the scraper deletes MD file and mdfilepath
      // fs.unlinkSync(record.mdfilepath);
      record.mdfilepath = null;
      await ScrapedPageRecordRepository.Update(record);
    }
    catch (e) {
      console.log("Switching to openai/gpt-oss-120b model for reliability");
      //US7AC5 Scraper switches between two suitable models if error occurs
      try {
        await Promise.all([ExtractFields(record, contents, "openai/gpt-oss-120b"), Sleep(30000)]);
        count++;
        record.mdfilepath = null;
        await ScrapedPageRecordRepository.Update(record);
      }
      catch (e) {
        console.error("Caught error when extracting fields", e);
        break;
      }
    }
  }

  ServiceBusy = false;
  message.reply(`Extracted fields from ${count} Markdown files`);
}
