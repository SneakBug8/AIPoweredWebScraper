import * as dotenv from "dotenv";
dotenv.config();

import { Config } from "./config";
import { TgBotServer } from "./App";

export { setWaitingForValue, setWaitingForValuePure } from "./App";
export { defaultKeyboard } from "./api/keyboards";
export { MessageWrapper } from "./MessageWrapper";

console.log("Bot started");

if (!Config.isTest() && !Config.isDev()) {
    try {
        TgBotServer.SendMessage("Bot restarted");
    }
    catch (e) {
        console.error("[Startup] Failed to send restart notification:", e);
    }
}
TgBotServer.loaded = true;
console.log("Bot started");
