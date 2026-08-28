import { ConstructNamedConnection } from "../Database";
import { Entity } from "../entity/Entity";
import { EntityFactory } from "../entity/EntityFactory";

export class ApartmentPosting extends Entity {
  public city = "Moscow";
  public subwayStation = "";
  public subwayDistance = 0;
  public transportAvailabiity = 0;
  public year_of_construction = "";
  public area = 0;
  public price = 0;
  public price_per_meter = 0;
  public type = "";
  public shop = "CIAN";
  public source = "";
}

class ApartmentPostingRepositoryClass extends EntityFactory<ApartmentPosting> {
  public async GetLatest(count: number): Promise<ApartmentPosting[]> {
    const entries = await this.Connection()
      .orderBy("MIS_DT", "desc")
      .limit(count)
      .select() as ApartmentPosting[];
    return Promise.all(entries.map(x => this.Parse(x)));
  }

  public async GetWithSource(source: string): Promise<ApartmentPosting> {
    const entry = await this.Connection()
      .where("source", source)
      .select().first() as ApartmentPosting;
    return this.Parse(entry);
  }

  public async Parse(t: ApartmentPosting): Promise<ApartmentPosting> {
    return t;
  }

  public async Cleanup(t: ApartmentPosting): Promise<ApartmentPosting> {
    return t;
  }
}

export const ApartmentsDb = ConstructNamedConnection("apartments");
export const ApartmentPostingsConnection = () => ApartmentsDb<ApartmentPosting>("ApartmentPostings");
export const ApartmentPostingRepository = new ApartmentPostingRepositoryClass(ApartmentPostingsConnection);

export async function EnsureApartmentPostingsTable() {
    const exists = await ApartmentsDb.schema.hasTable("ApartmentPostings");
    if (!exists) {
        await ApartmentsDb.schema.createTable("ApartmentPostings", (table) => {
            table.increments("Id").primary();
            table.text("city");
            table.text("subwayStation");
            table.integer("subwayDistance");
            table.integer("transportAvailabiity");
            table.text("year_of_construction");
            table.integer("area");
            table.integer("price");
            table.text("type");
            table.text("shop");
            table.text("source");
            table.integer("MIS_DT");
            table.integer("UPDATED_DT");
            table.integer("DELETED_DT");
        });
    }

    const exists2 = await ApartmentsDb.schema.hasColumn("ApartmentPostings", "price_per_meter");
    if (!exists2) {
        await ApartmentsDb.schema.alterTable("ApartmentPostings", (table) => {
            table.integer("price_per_meter");
        });
    }
}

EnsureApartmentPostingsTable();
