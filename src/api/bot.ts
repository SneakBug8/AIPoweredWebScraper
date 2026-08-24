import TelegramBot from "node-telegram-bot-api";

const token = process.env.token as string;

export const BotAPI = new TelegramBot(token, { polling: {interval:60000, autoStart:true} });
