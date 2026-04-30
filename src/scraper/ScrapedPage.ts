import { Connection, ConstructNamedConnection } from "../Database";
import { Entity } from "../entity/Entity";
import { EntityFactory } from "../entity/EntityFactory";

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
}

export const ScrapedPageRecordConnection = () => Connection<ScrapedPageRecord>("ScrapedPageRecords");
export const ScrapedPageRecordRepository = new ScrapedPageRecordRepositoryClass(ScrapedPageRecordConnection);
