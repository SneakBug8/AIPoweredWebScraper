import TelegramBot from "node-telegram-bot-api";
import { GetBotAPI } from "./api/bot";
import { defaultKeyboard } from "./api/keyboards";
import { MIS_DT } from "./util/MIS_DT";

export class MessageWrapper
{
    public response: TelegramBot.Message;

    constructor(message: TelegramBot.Message)
    {
        this.response = message;
    }

    public deleteAfterTime(minutes: number)
    {
        const bot = GetBotAPI();
        if (!bot) return this;

        setTimeout(() =>
        {
            try {
                bot.deleteMessage(this.response.chat.id, this.response.message_id.toString());
            }
            catch (e) {
                console.error("[MessageWrapper] Failed to delete message:", e);
            }
        }, 1000 * 60 * minutes);

        return this;
    }

    public async reply(text: string, keyboard: TelegramBot.KeyboardButton[][] | null = null, parse_mode : TelegramBot.ParseMode = 'Markdown')
    {
        const bot = GetBotAPI();
        if (!bot) {
            console.log(`[MessageWrapper] (Console reply) ${text}`);
            return null;
        }

        try {
            const msg = await bot.sendMessage(this.response.chat.id, text || "None.", {
                parse_mode: parse_mode,
                reply_markup: {
                    keyboard: keyboard || defaultKeyboard(),
                },
            });
            return new MessageWrapper(msg);
        }
        catch (e) {
            console.error("[MessageWrapper] Failed to send reply:", e);
            return null;
        }
    }

    public async replyMany(texts: string[])
    {
        const res: MessageWrapper[] = [];
        const bot = GetBotAPI();
        if (!bot) return res;

        for (const message of texts) {
            if (!message.length) {
                continue;
            }
            try {
                const msg = await bot.sendMessage(this.response.chat.id, message);
                res.push(new MessageWrapper(msg));
            }
            catch (e) {
                console.error("[MessageWrapper] Failed to send reply:", e);
            }
        }
        return res;
    }

    public checkRegex(regexp: RegExp)
    {
        if (!this.response.text) {
            return false;
        }

        return regexp.test(this.response.text);
    }

    public captureRegex(regexp: RegExp)
    {
        if (!this.response.text) {
            return undefined;
        }

        const captures = regexp.exec(this.response.text);

        if (!captures) { return undefined; }

        return captures;
    }

    public getPrintableTime()
    {
        const now = this.response.date * 1000;
        return MIS_DT.FormatTime(now);
    }
}
