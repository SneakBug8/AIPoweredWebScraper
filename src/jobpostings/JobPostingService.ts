import { MessageWrapper } from "../MessageWrapper";
import { RunFullScraping } from "../scraper/ScraperService";
import { JobBeeline as JobBeelineSource } from "../scraper/ScrapeSource";

// US1 User initiates scraping with /scrape command
export async function ProcessJobPosting(message: MessageWrapper) {
  if (message.checkRegex(/\/scrape_beeline/)) {
    RunFullScraping(JobBeelineSource);
    return true;
  }
  return false;
}

// TODO: Read new pages from source, filter relevant to the user and send notifications