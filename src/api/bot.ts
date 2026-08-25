// import "./socksproxy.js";

import TelegramBot from "node-telegram-bot-api";

let bot: TelegramBot | null = null;
let initFailed = false;

export function GetBotAPI(): TelegramBot | null {
    if (initFailed) return null;
    if (bot) return bot;

    try {
        const token = process.env.token as string;
        if (!token) {
            console.error("[BotAPI] No Telegram token found");
            initFailed = true;
            return null;
        }
        bot = new TelegramBot(token, { polling: {interval: 60000, autoStart: true} });
        return bot;
    }
    catch (e) {
        console.error("[BotAPI] Failed to initialize Telegram bot:", e);
        initFailed = true;
        return null;
    }
}

export function IsBotAvailable(): boolean {
    return GetBotAPI() !== null;
}
