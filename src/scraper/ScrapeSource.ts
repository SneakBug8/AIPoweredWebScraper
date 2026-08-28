import { By, WebDriver } from "selenium-webdriver";

export interface ScrapeSource {
    folderName: string;
    initialURLs: string[];
    categoryUrl: string;
    rootElementSelectors: string[];
    unwantedElementsSelectors: Array<string>;
    isBusy: boolean;
    minInterval: number;
    // Web scraper skips the page if filter returns false
    filter: (x: WebDriver) => Promise<boolean>
}

export const KentavarSource: ScrapeSource = {
    folderName: "kentavar",
    initialURLs: ["https://www.kentavar.bg/prodajba-na-avtomobili-vtora-upotreba"],
    categoryUrl: "https://www.kentavar.bg/prodajba-na-avtomobili-vtora-upotreba",
    rootElementSelectors: [".container"],
    unwantedElementsSelectors: ['a:has(>img)', 'img', '.contact'],
    isBusy: false,
    minInterval: 1000,
    filter: async (x) => true
};

export const AutoBgSource: ScrapeSource = {
    folderName: "autobg",
    initialURLs: ["https://www.auto.bg/obiavi/avtomobili-dzhipove"],
    categoryUrl: "https://www.auto.bg/obiava",
    rootElementSelectors: ["main .container"],
    unwantedElementsSelectors: ["header", 'a:has(>img)', 'img', '.contact', '.popular-brands-models', "iframe"],
    isBusy: false,
    minInterval: 1000,
    filter: async (x) => true
};

export const JobBeelineSource: ScrapeSource = {
    folderName: "jobbeeline",
    initialURLs: ["https://job.beeline.ru/vacancies", "https://job.beeline.ru/vacancies?work-format=work_format_03", "https://job.beeline.ru/vacancies?supervisor=true"],
    categoryUrl: "https://job.beeline.ru/vacancies",
    rootElementSelectors: ["[class^='_vacancy']"],
    unwantedElementsSelectors: ["header", 'a:has(>img)', 'img', "[class^='_footer']", "[class^='_header']", "[class^='_cookies']", "iframe"],
    isBusy: false,
    minInterval: 1000,
    filter: async (x) => true
};

// Since Beeline doesn't have "similar jobs" block that would allow easy traversal, we have to apply various filters by hand
for (let i = 1; i < 129; i++) {
    const roles = `role_${String(i).padStart(3, "0")}`;;

    JobBeelineSource.initialURLs.push(
        `https://job.beeline.ru/vacancies?roles=${roles}`
    );
}

export const JobBNPParibasSource: ScrapeSource = {
    folderName: "bnpparibas",
    initialURLs: ["https://group.bnpparibas/en/careers/all-job-offers", "https://group.bnpparibas/en/careers/all-job-offers/digital-transformation-and-data"],
    categoryUrl: "https://group.bnpparibas/en/careers/job-offer/",
    rootElementSelectors: ["main"],
    unwantedElementsSelectors: ["header", 'a:has(>img)', 'img', "svg", "form", "iframe"],
    isBusy: false,
    minInterval: 1000,
    filter: async (x) => true
};

// Add paging for traversal
for (let i = 2; i < 240; i++) {
    const d = JobBNPParibasSource.initialURLs[0];
    JobBeelineSource.initialURLs.push(
        `${d}?page=${i}`
    );
}

export const ApartmentCianSource: ScrapeSource = {
    folderName: "cian",
    initialURLs: ["https://www.cian.ru/cat.php?currency=2&deal_type=sale&engine_version=2&flat_share=2&maxprice=10000000&mintarea=30&offer_type=flat&region=1",
        "https://lyubertsy.cian.ru/cat.php?currency=2&deal_type=sale&engine_version=2&flat_share=2&maxprice=10000000&mintarea=30&offer_type=flat&region=175231"
    ],
    categoryUrl: "https://www.cian.ru/sale/flat/",
    rootElementSelectors: ["#frontend-offer-card"],
    unwantedElementsSelectors: ["header", 'a:has(>img)', 'img', "[data-name='NewbuildingMortgageSection']", "[data-name='SimilarOffersSection']", "iframe", "form", "svg"],
    isBusy: false,
    minInterval: 30000,
    filter: async (driver) => {
        try {
            const priceElement = await driver.findElement(By.css("[data-testid='price-amount'] span"));
            if (!priceElement)
                return false;


            const innerText = await priceElement.getText();
            const number = Number(innerText.replace(/[^0-9.-]/g, ""));
            return number < 15_000_000;
        }
        catch (e) {
            return false;
        }
    }
};

// Since Cian has pagination and its contents change rapidly, add some pages into initial scraping queue
function expandCian() {
    const acscopy = [...ApartmentCianSource.initialURLs];
    for (const s of acscopy) {
        for (let i = 2; i < 10; i++) {
            ApartmentCianSource.initialURLs.push(
                `${s}&p=${i}`
            );
        }
    }
}
expandCian();