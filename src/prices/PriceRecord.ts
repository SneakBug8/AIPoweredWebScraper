import { ConstructNamedConnection } from "../Database";
import { Entity } from "../entity/Entity";
import { EntityFactory } from "../entity/EntityFactory";

export class PriceRecord extends Entity {
  public category = "";
  public shop = "";
  public commodity = "";
  public price = 0;
  public volume = 0;
  public unit = "";
  public pricePer1000: number | undefined;
}

class PriceRecordRepositoryClass extends EntityFactory<PriceRecord> {
  public async GetLatest(count: number): Promise<PriceRecord[]> {
    const entries = await this.Connection()
      .orderBy("MIS_DT", "desc")
      .limit(count)
      .select() as PriceRecord[];
    return Promise.all(entries.map(x => this.Parse(x)));
  }

  public async GetCheapestByCategory(): Promise<PriceRecord[]> {
    const all = await this.GetAll();
    const map = new Map<string, PriceRecord>();

    for (const record of all) {
      const cat = record.category.toLowerCase();
      const existing = map.get(cat);

      if (!existing || (record.pricePer1000 !== undefined && existing.pricePer1000 !== undefined && record.pricePer1000 < existing.pricePer1000)) {
        map.set(cat, record);
      }
    }

    return Array.from(map.values());
  }

  public async Parse(t: PriceRecord): Promise<PriceRecord> {
    if (t.volume > 0) {
      t.pricePer1000 = (t.price / t.volume) * 1000;
    } else {
      t.pricePer1000 = 0;
    }
    return t;
  }

  public async Cleanup(t: PriceRecord): Promise<PriceRecord> {
    delete t.pricePer1000;
    return t;
  }
}

const PricesDB = ConstructNamedConnection("prices");

export const PricesConnection = () => PricesDB<PriceRecord>("PriceRecords");
export const PriceRecordRepository = new PriceRecordRepositoryClass(PricesConnection);
