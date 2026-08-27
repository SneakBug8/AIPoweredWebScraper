import TelegramBot from "node-telegram-bot-api";
import { GetBotAPI } from "./api/bot";
import { MessageWrapper } from "./MessageWrapper";
import { AuthService } from "./AuthService";
import { Config } from "./config";
import { BackupCycle, ProcessBackup } from "./backup/BackupService";
import { Sleep } from "./util/Sleep";
import { Scheduler } from "./util/Scheduler";
import { ErrorLogger } from "./util/ErrorLogger";
import { SyncEvent } from "./util/SyncEvent";
import { defaultKeyboard } from "./api/keyboards";
import { MarkdownHelper } from "./util/MarkdownHelper";
import { ProcessCarScraper } from "./carpostings/CarPostingService";
import { ProcessJobPosting } from "./jobpostings/JobPostingService";
import { ProcessApartmentPostings } from "./apartments/ApartmentPostingService";

let waitingCallback: ((message: MessageWrapper) => any) | null = null;

export function setWaitingForValue(message: string, callback: (message: MessageWrapper) => any) {
    TgBotServer.SendMessage(message, [[{ text: "/exit" }]]);
    waitingCallback = callback;
}

export function setWaitingForValuePure(callback: (message: MessageWrapper) => any) {
    waitingCallback = callback;
}

class App {
    private bot: TelegramBot | null = null;
    private readingMessage: boolean = false;
    public loaded = false;

    public MessageEvent = new SyncEvent();
    public IntervalEvent = new SyncEvent();

    public async WaitForLoad() {
        while (!this.loaded) {
            await Sleep(500);
        }
    }

    public constructor() {
        this.bot = GetBotAPI();

        if (this.bot) {
            this.bot.on("text", async (msg) => {
                while (this.readingMessage) {
                    await Sleep(100);
                }
                this.readingMessage = true;
                await this.messageHandler(msg);
                this.readingMessage = false;
            });
        }
        else {
            console.warn("[App] Telegram bot unavailable, running in console-only mode");
        }

        setInterval(this.Intervals.bind(this), 15 * 60 * 1000);
    }

    public async Intervals() {
        const intervals = [
            Scheduler.Interval.bind(Scheduler),
            BackupCycle,
        ];

        for (const listener of intervals) {
            try {
                const r = await listener();
            }
            catch (e) {
                ErrorLogger.Log(e);
            }
        }

        this.IntervalEvent.Emit();
    }

    private async messageHandler(msg: TelegramBot.Message) {
        try {
            const message = new MessageWrapper(msg);
            const time = message.getPrintableTime();
            console.log(`[${time}] ${msg.text}`);

            if (message.checkRegex(/^\/id/)) {
                message.reply(`Current chat id: ${message.response.chat.id}`); return;
            }

            if (message.checkRegex(/^\/auth/)) {
                AuthService.ResetAuth();
            }

            let res = AuthService.CheckAuth(msg.chat.id);
            if (!res) {
                res = AuthService.TryAuth(msg.text + "", msg.chat.id);
                if (res) {
                    message.reply("Authorized successfuly")
                        .then((newmsg) => newmsg?.deleteAfterTime(1));
                    return;
                }
                else {
                    message.reply("Wrong password")
                        .then((newmsg) => newmsg?.deleteAfterTime(1));
                    return;
                }
            }

            if (!res) {
                message.reply("You are not authorized")
                    .then((newmsg) => newmsg?.deleteAfterTime(1));
                return;
            }

            if (!msg.text) {
                return;
            }

            if (waitingCallback) {
                if (message.response.text === "/exit") {
                    waitingCallback = null; return;
                }

                const callback = waitingCallback;
                waitingCallback = null;
                await callback.call(this, message);

                return true;
            }

            if (message.checkRegex(/\/exit/)) {
                return message.reply("Main module.");
            }

            const listeners = [
                ProcessCarScraper,
                ProcessJobPosting,
                ProcessApartmentPostings,
                ProcessBackup,
            ];

            for (const listener of listeners) {
                const r = await listener(message);
                if (r !== false) {
                    return;
                }
            }

            const d = await this.MessageEvent.Emit(message);
            if (d) {
                return;
            }

            //if (!message.checkRegex(/^\/.*$/)) {
                //
            //}
            //else {
                message.reply("Unknown command");
            //}
        }
        catch (e) {
            TgBotServer.SendMessage(e + "");
        }
    }

    public SendMessage(text: string, keyboard: TelegramBot.KeyboardButton[][] | null = null, parse_mode: TelegramBot.ParseMode = "Markdown"): Promise<MessageWrapper | null>[] {
        const bot = GetBotAPI();
        if (!bot) {
            console.log(`[App] (Console) ${text}`);
            return [Promise.resolve(null)];
        }

        if (text.length <= 4000)
            return [this.SendSingleMessage(text, keyboard, parse_mode)]
        let promises = [];
        const pieces = MarkdownHelper.splitMarkdown(text, 4000);
        for (const piece of pieces) {
            const p = this.SendSingleMessage(piece, keyboard, parse_mode);
            promises.push(p);
        }
        return promises;
    }

    private async SendSingleMessage(text: string, keyboard: TelegramBot.KeyboardButton[][] | null = null, parse_mode: TelegramBot.ParseMode = "Markdown") {
        const bot = GetBotAPI();
        if (!bot) {
            console.log(`[App] (Console) ${text}`);
            return null;
        }

        try {
            // Two attempts to send the message
            try {
                const msg = await bot.sendMessage(Config.DefaultChat, text || "null", {
                    parse_mode,
                    reply_markup: {
                        keyboard: keyboard || defaultKeyboard(),
                    }
                });
                console.log(text);
                await Sleep(1000);
                return new MessageWrapper(msg);
            }
            catch (e) {
                const msg = await bot.sendMessage(Config.DefaultChat, text || "null", {
                    reply_markup: {
                        keyboard: keyboard || defaultKeyboard(),
                    }
                });
                await Sleep(1000);
                return new MessageWrapper(msg);
            }
        }
        catch (e) {
            console.error("[App]", JSON.parse(JSON.stringify(e)));
            try {
                const msg = await bot.sendMessage(Config.DefaultChat, JSON.stringify(e) || "Error: null", {
                    parse_mode,
                    reply_markup: {
                        keyboard: keyboard || defaultKeyboard(),
                    }
                });
                await Sleep(1000);
                return new MessageWrapper(msg);
            }
            catch (e2) {
                console.error("[App] Failed to send error message:", JSON.parse(JSON.stringify(e2)));
                return null;
            }
        }
    }
}

export const TgBotServer = new App();
