import * as dotenv from "dotenv";
dotenv.config();

import TelegramBot = require("node-telegram-bot-api");
import { BotAPI } from "./api/bot";
import { MessageWrapper } from "./MessageWrapper";
import { AuthService } from "./AuthService";
import { Config } from "./config";
import { BackupCycle, InitBackup, ProcessBackup } from "./backup/BackupService";
import { Sleep } from "./util/Sleep";
import { Scheduler } from "./util/Scheduler";
import { ErrorLogger } from "./util/ErrorLogger";
import { SyncEvent } from "./util/SyncEvent";
import { ProcessCarScraper } from "./carpostings/CarPostingService";

let waitingCallback: ((message: MessageWrapper) => any) | null = null;

export function setWaitingForValue(message: string, callback: (message: MessageWrapper) => any)
{
    Server.SendMessage(message, [[{ text: "/exit" }]]);
    waitingCallback = callback;
}

export function setWaitingForValuePure(callback: (message: MessageWrapper) => any)
{
    waitingCallback = callback;
}

export function defaultKeyboard(): TelegramBot.KeyboardButton[][]
{
    return [
        [{ text: "/scrape_kentavar" }, { text: "/scrape_autobg" }],
        [{ text: "/convert_to_md" }, { text: "/extract_fields" }],
    ];
}

class App
{
    private bot: TelegramBot;
    private readingMessage: boolean = false;
    public loaded = false;

    public MessageEvent = new SyncEvent();
    public IntervalEvent = new SyncEvent();

    public async WaitForLoad()
    {
        while (!this.loaded) {
            await Sleep(500);
        }
    }

    public constructor()
    {
        this.bot = BotAPI;


        // Web modules
        // PriceRecordWebService.Init();

        this.bot.on("text", async (msg) =>
        {
            while (this.readingMessage) {
                await Sleep(100);
            }
            this.readingMessage = true;
            await this.messageHandler(msg);
            this.readingMessage = false;

        });

        setInterval(this.Intervals.bind(this), 15 * 60 * 1000);
    }

    public async Intervals()
    {
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

    private async messageHandler(msg: TelegramBot.Message)
    {
        try {
            const message = new MessageWrapper(msg);
            const time = message.getPrintableTime();
            console.log(`[${time}] ${msg.text}`);

            if (message.checkRegex(/^\/id/)) {
                message.reply(`Current chat id: ${message.message.chat.id}`); return;
            }

            if (message.checkRegex(/^\/auth/)) {
                AuthService.ResetAuth();
            }

            let res = AuthService.CheckAuth(msg.chat.id);
            if (!res) {
                res = AuthService.TryAuth(msg.text + "", msg.chat.id);
                if (res) {
                    message.reply("Authorized successfuly")
                        .then((newmsg) => newmsg.deleteAfterTime(1));
                    return;
                }
                else {
                    message.reply("Wrong password")
                        .then((newmsg) => newmsg.deleteAfterTime(1));
                    return;
                }
            }

            if (!res) {
                message.reply("You are not authorized")
                    .then((newmsg) => newmsg.deleteAfterTime(1));
                return;
            }

            if (!msg.text) {
                return;
            }

            if (waitingCallback) {
                if (message.message.text === "/exit") {
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

            if (!message.checkRegex(/^\/.*$/)) {
                // await ProcessAssistant(message);
            }
            else {
                message.reply("Unknown command");
            }
        }
        catch (e) {
            Server.SendMessage(e + "");
        }
    }

    public async SendMessage(text: string, keyboard: TelegramBot.KeyboardButton[][] | null = null, parse_mode: TelegramBot.ParseMode = "Markdown")
    {
        try {
            console.log(text);
            const msg = await BotAPI.sendMessage(Config.DefaultChat, text || "null", {
                parse_mode,
                reply_markup: {
                    keyboard: keyboard || defaultKeyboard(),
                }
            });
            return new MessageWrapper(msg);
        }
        catch (e) {
            console.error(JSON.parse(JSON.stringify(e)));
            const msg = await BotAPI.sendMessage(Config.DefaultChat, JSON.stringify(e) || "Error: null", {
                parse_mode,
                reply_markup: {
                    keyboard: keyboard || defaultKeyboard(),
                }
            });
            return new MessageWrapper(msg);
        }
    }
}

export const Server = new App();


console.log("Bot started");

if (!Config.isTest() && !Config.isDev()) {
    Server.SendMessage("Bot restarted");
}
Server.loaded = true;
