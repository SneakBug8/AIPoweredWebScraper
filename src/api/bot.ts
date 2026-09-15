import TelegramBot from "node-telegram-bot-api";
import { SocksProxyAgent } from "socks-proxy-agent";

let bot: TelegramBot | null = null;
let initFailed = false;

// Toggleable Telegram connection proxy. When `telegram_proxy` is set in .env (e.g.
// socks5://127.0.0.1:5000), every Telegram API request (polling getUpdates, sends, uploads)
// is routed through that SOCKS proxy via the agent option. Without it, the connection goes
// direct. No auth is supported: use a user:pass in the URL if your proxy requires one.
function buildProxyRequest(): TelegramBot.ConstructorOptions["request"] {
    const proxyUrl = process.env.telegram_proxy;
    if (!proxyUrl) return undefined;
    return { agent: new SocksProxyAgent(proxyUrl) } as unknown as TelegramBot.ConstructorOptions["request"];
}

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
        const proxyRequest = buildProxyRequest();
        bot = new TelegramBot(token, { polling: {interval: 60000, autoStart: true}, ...(proxyRequest ? { request: proxyRequest } : {}) });
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
