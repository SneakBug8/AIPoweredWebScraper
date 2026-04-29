import { MessageWrapper } from "../MessageWrapper";
import { PriceRecordRepository } from "./PriceRecord";
import { MIS_DT } from "../util/MIS_DT";
import { Config } from "../config";

function reply(msg: MessageWrapper, text: string) {
  msg.reply(text);
}

export async function ProcessPriceRecords(message: MessageWrapper) {
  if (message.checkRegex(/\/prices list/)) {
    const latest = await PriceRecordRepository.GetLatest(10);

    if (latest.length === 0) {
        reply(message, "No price records found.");
        return true;
    }

    let res = "Latest 10 price records:\n";
    for (const entry of latest) {
      res += `\n${MIS_DT.FormatDate(entry.MIS_DT)}: ${entry.commodity} at ${entry.shop} - ${entry.price} per ${entry.volume} ${entry.unit} (${entry.category}) | Price/1000: ${entry.pricePer1000?.toFixed(2)}`;
    }

    reply(message, res);
    return true;
  }

  if (message.checkRegex(/^\/prices$/)) {
    reply(message, `Prices module.\n` +
      `Dashboard: \n`);
    return true;
  }

  return false;
}
