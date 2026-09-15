import * as dotenv from "dotenv";
import { Config } from "../config";
dotenv.config();
import { TgBotServer } from "../App";

console.log("App imported");

exports.mochaHooks = {
    async before()
    {
        await TgBotServer.WaitForLoad();
        //  Config.setTest();
    }
};
