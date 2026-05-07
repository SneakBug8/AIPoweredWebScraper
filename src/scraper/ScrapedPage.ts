import { Connection, ConstructNamedConnection } from "../Database";
import { Entity } from "../entity/Entity";
import { EntityFactory } from "../entity/EntityFactory";
import { MapAsync } from "../util/MapAsync";
import { MIS_DT } from "../util/MIS_DT";

export class ScrapedPageRecord extends Entity {
  public URL = "";
  public htmlfilepath : string | null = null;
  public mdfilepath : string | null = null;
  public LAST_FETCHED = 0;
}

class ScrapedPageRecordRepositoryClass extends EntityFactory<ScrapedPageRecord> {
  public async GetLatest(count: number): Promise<ScrapedPageRecord[]> {
    const entries = await this.Connection()
      .orderBy("MIS_DT", "desc")
      .limit(count)
      .select() as ScrapedPageRecord[];
    return Promise.all(entries.map(x => this.Parse(x)));
  }

  public async GetWithURL(url: string): Promise<ScrapedPageRecord> {
      const entry = await this.Connection()
        .where("URL", url)
        .select().first() as ScrapedPageRecord;
      return this.Parse(entry);
    }

  public async Parse(t: ScrapedPageRecord): Promise<ScrapedPageRecord> {
    return t;
  }

  public async Cleanup(t: ScrapedPageRecord): Promise<ScrapedPageRecord> {
    return t;
  }

  public async GetMDExtractionQueue() {
    const entries = await this.Connection()
    .whereNotNull("htmlfilepath")
    .whereNull("mdfilepath")
    .select() as ScrapedPageRecord[];
    const r = MapAsync.Map(entries, async (x) => await this.Parse(x));
    return r;
  }

  public async GetFieldExtractionQueue() {
    const entries = await this.Connection()
    .whereNotNull("mdfilepath")
    .select() as ScrapedPageRecord[];
    const r = MapAsync.Map(entries, async (x) => await this.Parse(x));
    return r;
  }

  public async GetRecentlyScrapedURLs() {
    const entries = await this.Connection()
    .whereNotNull("htmlfilepath")
    .andWhere("LAST_FETCHED", ">", MIS_DT.GetDay() - MIS_DT.OneDay() * 30)
    .select() as ScrapedPageRecord[];
    const r = MapAsync.Map(entries, async (x) => await this.Parse(x));

    const urls = entries.map((x) => x.URL);

    return urls;
  }

  public async GetScrapingQueueURLs() {
    const entries = await this.Connection()
    .whereNull("htmlfilepath")
    .andWhere("LAST_FETCHED", "<=", MIS_DT.GetDay() - MIS_DT.OneDay() * 30)
    .select() as ScrapedPageRecord[];
    const r = MapAsync.Map(entries, async (x) => await this.Parse(x));

    const urls = entries.map((x) => x.URL);

    return urls;
  }
}

export const ScrapedPageRecordConnection = () => Connection<ScrapedPageRecord>("ScrapedPageRecords");
export const ScrapedPageRecordRepository = new ScrapedPageRecordRepositoryClass(ScrapedPageRecordConnection);
