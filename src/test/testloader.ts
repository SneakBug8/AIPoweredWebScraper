import * as dotenv from "dotenv";
import { Config } from "../config";
dotenv.config();
import * as App from "../index";

console.log("App imported");

exports.mochaHooks = {
    async before()
    {
        await App.Server.WaitForLoad();
        //  Config.setTest();
    }
};
