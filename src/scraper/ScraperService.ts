import { MessageWrapper } from "../MessageWrapper";
import { MIS_DT } from "../util/MIS_DT";
import { Config } from "../config";
import { Builder, Browser, By, Key, until, ThenableWebDriver, WebDriver } from 'selenium-webdriver';
import { Sleep } from "../util/Sleep";
import * as fs from "fs";
import * as path from "path";
// import { convert } from "@kreuzberg/html-to-markdown-node";

function reply(msg: MessageWrapper, text: string) {
  msg.reply(text);
}

let PagesScraped = 0;
let ScrapedURLs = new Array<string>();
let URLsQueue = new Array<string>();

async function ScrapePage(driver: WebDriver, url: string, categoryUrl: string) {
  if (ScrapedURLs.includes(url)) {
    console.log(`Skipping already visited page ${url}`);
    return;
  }
  console.log(`Opening page ${url}, queue ${URLsQueue.length}`);

  await driver.get(url);

  await Sleep(3000);

  const pagepieces = url.split("/");
  const pagename = pagepieces[pagepieces.length-1].replace("?","-").replace(".","-").replace("=","-"); //await driver.getTitle();

  const pagehtmlpath = path.resolve(Config.dataPath(), "kentavar/" + pagename + ".html");
  fs.writeFileSync(pagehtmlpath, await driver.getPageSource())

  //if ((await driver.getPageSource()).includes("или купи на изплащане"))
  //  ExtractMarkdown(pagehtmlpath);

  for (const element of await driver.findElements(By.css('a'))) {
    const href = await element.getAttribute("href");
    if (href && !ScrapedURLs.includes(href) && href.includes(categoryUrl)) {
      URLsQueue.push(href);
    }
  }

  ScrapedURLs.push(url);

  while (URLsQueue.length) {
    const url = URLsQueue.pop();
    if (!url)
      return;
    await ScrapePage(driver, url, categoryUrl);
  }
  // .sendKeys('webdriver', Key.RETURN)
}

async function ExtractMarkdown(pagehtmlpath: string) {
  const contents = fs.readFileSync(pagehtmlpath).toString();
  // TypeScript / Node.js
  
  //const res = convert(contents);

 // const markdownpath = path.resolve(Config.dataPath(), "kentavar_md/" + path.basename(pagehtmlpath) + ".md");
  //fs.writeFileSync(markdownpath, res.content);
}

export async function ProcessScraper(message: MessageWrapper) {
  if (message.checkRegex(/\/scrape/)) {
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
    return true;
  }
  return false;
}
