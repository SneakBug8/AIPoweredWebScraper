import { MessageWrapper } from "../MessageWrapper";
import { MIS_DT } from "../util/MIS_DT";
import { Config } from "../config";
import { Builder, Browser, By, Key, until, ThenableWebDriver, WebDriver } from 'selenium-webdriver';
import { Sleep } from "../util/Sleep";
import * as fs from "fs";
import * as path from "path";
import TurndownService from 'turndown';

function reply(msg: MessageWrapper, text: string) {
  msg.reply(text);
}

// US2 The scraper does scraping autonomously
// US2AC1 The scraper maintains a list of already scraped URLs
let ScrapedURLs = new Array<string>();
// US2AC2 The scraper maintains a queue of URLs to scrape
let URLsQueue = new Array<string>();
// US2AC3 The scraper keeps count of how many pages it scraped
let PagesScraped = 0;

async function ScrapePage(driver: WebDriver, url: string, categoryUrl: string) {
  // US2AC4 If URL to scrape has already been scraped, the scraper ignores it
  if (ScrapedURLs.includes(url)) {
    console.log(`Skipping already visited page ${url}`);
    return;
  }
  console.log(`Opening page ${url}, queue ${URLsQueue.length}`);

  // US2AC5 The scraper waits for the page to load and applies artificial delay to scraping
  await Promise.race([driver.get(url), Sleep(5000)]);

  // US4 The scraper saves the html of the page to the filesystem
  const pagepieces = url.split("/");
  const pagename = pagepieces[pagepieces.length-1].replace("?","-").replace(".","-").replace("=","-"); //await driver.getTitle();

  // US5 The scraper removes some unwanted elements from the page
  const unwantedElements = [...await driver.findElements(By.css('img')), await driver.findElements(By.css('.contact'))]
  for (const element of unwantedElements) {
    await driver.executeScript(`
      var element = arguments[0];
      if (element && element.parentNode)
        element.parentNode.removeChild(element);
      `, element);
  }

  // US4AC1 To remove clutter, the scraper saves only meaningful part of the page
  const pagehtmlpath = path.resolve(Config.dataPath(), "kentavar/" + pagename + ".html");
  const bodyel = await driver.findElement(By.css(".container"));
  fs.writeFileSync(pagehtmlpath, await bodyel.getAttribute("innerHTML"));

  // US4AC1 Only pages with actual cars (that have a buy button)
  //if ((await driver.getPageSource()).includes("или купи на изплащане"))
  //  ExtractMarkdown(pagehtmlpath);

  await Sleep(2000);

  // US2AC7 The scraper adds a[href] links on the page to the queue
  // US3 The scraper filters links it finds to narrow down search
  // US3AC1 The scraper follows the link only if it is part of the categoryUrl (base url)
  for (const element of await driver.findElements(By.css('a'))) {
    const href = await element.getAttribute("href");
    if (href && !ScrapedURLs.includes(href) && href.includes(categoryUrl)) {
      const sanitizedHref = href.replace("#", "");
      URLsQueue.push(sanitizedHref);
    }
  }

  ScrapedURLs.push(url);

  //US2AC8 The scraper continues scraping until the queue is empty
  while (URLsQueue.length) {
    const url = URLsQueue.pop();
    if (!url)
      return;
    await ScrapePage(driver, url, categoryUrl);
    // US2AC9 The scraper shuffles the queue to cover more pages with unfinished scrapes
    shuffle(URLsQueue);
  }
  // .sendKeys('webdriver', Key.RETURN)
}

// US4 The scraper extracts markdown files for processing
async function ExtractMarkdown(pagehtmlpath: string) {
  const contents = fs.readFileSync(pagehtmlpath).toString();
  
  //const res = convert(contents);
  var turndownService = new TurndownService();
  var markdown = turndownService.turndown(contents);

  const markdownpath = path.resolve(Config.dataPath(), "kentavar_md/" + path.basename(pagehtmlpath) + ".md");
  fs.writeFileSync(markdownpath, markdown);
}

async function ConvertAllToMd(message: MessageWrapper) {
  const folderpath = path.resolve(Config.dataPath(), "kentavar");

  let count = 0;

  for (const file of fs.readdirSync(folderpath)) {
    await ExtractMarkdown(path.resolve(folderpath, file));
    count++;
  }

  reply(message, `Converted ${count} files to Markdown`);
}

// US1AC3 Scraping is done async to bot operations
async function RunFullScraping(message: MessageWrapper) {
    const driver = await new Builder().forBrowser(Browser.FIREFOX).build();

    try {
      await ScrapePage(driver, "https://www.kentavar.bg/prodajba-na-avtomobili-vtora-upotreba", "https://www.kentavar.bg/prodajba-na-avtomobili-vtora-upotreba");
    }
    catch (e) {
      console.error(e);
    }
    finally {
      await driver.quit();
    }
    reply(message, `Scraped ${PagesScraped} pages`);
}

// US1 User initiates scraping with /scrape command
export async function ProcessScraper(message: MessageWrapper) {
  if (message.checkRegex(/\/scrape/)) {
    RunFullScraping(message);
    return true;
  }
  // US4AC1 /convert_to_md command converts all fetched html files
  else if (message.checkRegex(/\/convert_to_md/)) {
    //US4AC2 Conversion is done async to the main bot flow
    ConvertAllToMd(message);
    return true;
  }
  return false;
}

function shuffle(array : Array<any>) {
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