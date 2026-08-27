import { MessageWrapper } from "../MessageWrapper";
import { RunFullScraping } from "../scraper/ScraperService";
import { ApartmentCianSource } from "../scraper/ScrapeSource";

export async function ProcessApartmentPostings(message: MessageWrapper) {
  if (message.checkRegex(/\/scrape_cian/)) {
    RunFullScraping(ApartmentCianSource);
    return true;
  }
  return false;
}
