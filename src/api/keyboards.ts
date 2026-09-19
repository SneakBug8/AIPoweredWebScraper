import TelegramBot from "node-telegram-bot-api";

export function defaultKeyboard(): TelegramBot.KeyboardButton[][]
{
    return [
        [{ text: "/scrape_kentavar" }, { text: "/scrape_autobg" }],
        [{ text: "/scrape_beeline" }, { text: "/scrape_cian" },],
        [{ text: "/scrape_knowledge" }, { text: "/extract_knowledge" }],
        [{ text: "/scrape_mckinsey" }, { text: "/extract_mckinsey" }],
        [{ text: "/status" }, { text: "/convert_to_md" }, { text: "/extract_cars" }],
    ];
}