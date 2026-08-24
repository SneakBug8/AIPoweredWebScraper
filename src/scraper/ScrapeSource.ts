export interface ScrapeSource {
    folderName: string;
    initialURLs: string[];
    categoryUrl: string;
    rootElementSelectors: string[];
    unwantedElementsSelectors: Array<string>;
    isBusy : boolean;
}

export const KentavarSource : ScrapeSource = {
    folderName: "kentavar",
    initialURLs: ["https://www.kentavar.bg/prodajba-na-avtomobili-vtora-upotreba"], 
    categoryUrl: "https://www.kentavar.bg/prodajba-na-avtomobili-vtora-upotreba",
    rootElementSelectors: [".container"],
    unwantedElementsSelectors: ['a:has(>img)', 'img', '.contact'],
    isBusy: false
};

export const AutoBgSource : ScrapeSource = {
    folderName: "autobg",
    initialURLs: ["https://www.auto.bg/obiavi/avtomobili-dzhipove"], 
    categoryUrl: "https://www.auto.bg/obiava",
    rootElementSelectors: ["main .container"],
    unwantedElementsSelectors: ["header", 'a:has(>img)', 'img', '.contact', '.popular-brands-models', "iframe"],
    isBusy: false

};

export const JobBeeline : ScrapeSource = {
    folderName: "jobbeeline",
    initialURLs: ["https://job.beeline.ru/vacancies", "https://job.beeline.ru/vacancies?work-format=work_format_03", "https://job.beeline.ru/vacancies?supervisor=true"], 
    categoryUrl: "https://job.beeline.ru/vacancies",
    rootElementSelectors: ["[class^='_vacancy']"],
    unwantedElementsSelectors: ["header", 'a:has(>img)', 'img', "[class^='_footer']", "[class^='_header']", "[class^='_cookies']", "iframe"],
    isBusy: false

};

// Since Beeline doesn't have "similar jobs" block that would allow easy traversal, we have to apply various filters by hand
for (let i = 1; i < 129; i++) {
    const roles = `role_${String(i).padStart(3, "0")}`;;

    JobBeeline.initialURLs.push(
        `https://job.beeline.ru/vacancies?roles=${roles}`
    );
}