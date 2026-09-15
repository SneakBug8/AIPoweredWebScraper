import * as fs from "fs";
import * as path from "path";
import { Config } from "../config.js";
import { MIS_DT } from "./MIS_DT.js";

export type JSONStructure = {[key: string]: any};

export function dumpDebugJSON(object: JSONStructure) {
    try {
    const filepath = path.resolve(Config.dataPath(), `errors/JSONdump${MIS_DT.GetExact()}.json`);
    fs.writeFileSync(filepath, JSON.stringify(object, null, 4));
    console.log(`Dumped new debug JSON at JSONdump${MIS_DT.GetExact()}.json`);
    }
    catch (e) {
        console.log("Error dumping debug JSON", e);
    }
}