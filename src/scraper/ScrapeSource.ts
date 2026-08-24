export interface ScrapeSource {
    folderName: string;
    initialUrl: string;
    categoryUrl: string;
    rootElementSelectors: string[];
    unwantedElementsSelectors: Array<string>;
}

export const KentavarSource : ScrapeSource = {
    folderName: "kentavar",
    initialUrl: "https://www.kentavar.bg/prodajba-na-avtomobili-vtora-upotreba", 
    categoryUrl: "https://www.kentavar.bg/prodajba-na-avtomobili-vtora-upotreba",
    rootElementSelectors: [".container"],
    unwantedElementsSelectors: ['a:has(>img)', 'img', '.contact'],
};

export const AutoBgSource : ScrapeSource = {
    folderName: "autobg",
    initialUrl: "https://www.auto.bg/obiavi/avtomobili-dzhipove", 
    categoryUrl: "https://www.auto.bg/obiava",
    rootElementSelectors: ["main .container"],
    unwantedElementsSelectors: ["header", 'a:has(>img)', 'img', '.contact', '.popular-brands-models', "iframe"],
};

export const JobBeeline : ScrapeSource = {
    folderName: "jobbeeline",
    initialUrl: "https://job.beeline.ru/vacancies", 
    categoryUrl: "https://job.beeline.ru/vacancies",
    rootElementSelectors: ["class^='_vacancy'"],
    unwantedElementsSelectors: ["header", 'a:has(>img)', 'img', "class^='_footer'", "class^='_header'", "class^='_cookies'", "iframe"],
};