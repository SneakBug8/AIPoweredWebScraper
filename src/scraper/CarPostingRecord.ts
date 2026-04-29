import { Connection, ConstructNamedConnection } from "../Database";
import { Entity } from "../entity/Entity";
import { EntityFactory } from "../entity/EntityFactory";

export class CarPostingRecord extends Entity {
  public car_brand = "";
  public model = "";
  public year_of_production = "";
  public mileage = 0;
  public price = 0;
  public shop = "default";
  public source = "";
}

class CarPostingRecordRepositoryClass extends EntityFactory<CarPostingRecord> {
  public async GetLatest(count: number): Promise<CarPostingRecord[]> {
    const entries = await this.Connection()
      .orderBy("MIS_DT", "desc")
      .limit(count)
      .select() as CarPostingRecord[];
    return Promise.all(entries.map(x => this.Parse(x)));
  }

  public async GetWithSource(source: string): Promise<CarPostingRecord> {
    const entry = await this.Connection()
      .where("source", source)
      .select().first() as CarPostingRecord;
    return this.Parse(entry);
  }

  public async Parse(t: CarPostingRecord): Promise<CarPostingRecord> {
    return t;
  }

  public async Cleanup(t: CarPostingRecord): Promise<CarPostingRecord> {
    return t;
  }
}

export const CarPostingsConnection = () => Connection<CarPostingRecord>("CarPostings");
export const CarPostingRecordRepository = new CarPostingRecordRepositoryClass(CarPostingsConnection);
