import TelegramBot from "node-telegram-bot-api";

export function defaultKeyboard(): TelegramBot.KeyboardButton[][]
{
    return [
        [{ text: "/scrape_kentavar" }, { text: "/scrape_autobg" }],
        [{ text: "/scrape_beeline" },],
        [{ text: "/status" }, { text: "/convert_to_md" }, { text: "/extract_fields" }],
    ];
}