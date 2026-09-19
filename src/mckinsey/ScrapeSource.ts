export interface ScrapeSource {
    folderName: string;
    initialUrl: string;
    categoryUrl: string;
    rootElementSelectors: string[];
    unwantedElementsSelectors: Array<string>;
}

export const McKinseyInsights : ScrapeSource = {
    folderName: "mckinseyinsights",
    initialUrl: "https://www.mckinsey.com/featured-insights", 
    categoryUrl: "https://www.mckinsey.com/",
    rootElementSelectors: ['[data-layer-region="article-body"]', "main", ".mck-o-container--outer", ".tbl_main", ".email-container", "body"],
    unwantedElementsSelectors: ['a:has(>img)', 'img', '.contact', "style", "script"],
};

export const ScrapeSources = [McKinseyInsights];