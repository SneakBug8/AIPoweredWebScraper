import { Entity } from "../entity/Entity";
import { EntityFactory } from "../entity/EntityFactory";
import { KnowledgeDb } from "./KnowledgeArticleRecord";

export class IndustryFact extends Entity {
  public topic = "";
  public metric = "";
  public value = "";
  public region = "";
  public qualifier = "";
  public fact = "";
  public date = "";
  public source = "";
}

class IndustryFactRepositoryClass extends EntityFactory<IndustryFact> {
  public async GetLatest(count: number): Promise<IndustryFact[]> {
    const entries = await this.Connection()
      .orderBy("MIS_DT", "desc")
      .limit(count)
      .select() as IndustryFact[];
    return Promise.all(entries.map(x => this.Parse(x)));
  }

  public async GetWithSource(source: string): Promise<IndustryFact[]> {
    const entries = await this.Connection()
      .where("source", source)
      .orderBy("MIS_DT", "desc")
      .select() as IndustryFact[];
    return Promise.all(entries.map(x => this.Parse(x)));
  }

  public async Parse(t: IndustryFact): Promise<IndustryFact> {
    return t;
  }

  public async Cleanup(t: IndustryFact): Promise<IndustryFact> {
    return t;
  }
}

export const IndustryFactsConnection = () => KnowledgeDb<IndustryFact>("IndustryFacts");
export const IndustryFactRepository = new IndustryFactRepositoryClass(IndustryFactsConnection);

let factsTableEnsurePromise: Promise<void> | null = null;

// US9AC7 The IndustryFacts table persists the region and qualifier columns
export function EnsureIndustryFactsTable() {
    if (!factsTableEnsurePromise) {
        factsTableEnsurePromise = EnsureIndustryFactsTableImpl();
    }
    return factsTableEnsurePromise;
}

async function EnsureIndustryFactsTableImpl() {
    const exists = await KnowledgeDb.schema.hasTable("IndustryFacts");
    if (!exists) {
        await KnowledgeDb.schema.createTable("IndustryFacts", (table) => {
            table.increments("Id").primary();
            table.text("topic");
            table.text("metric");
            table.text("value");
            table.text("region");
            table.text("qualifier");
            table.text("fact");
            table.text("date");
            table.text("source");
            table.integer("MIS_DT");
            table.integer("UPDATED_DT");
            table.integer("DELETED_DT");
        });
        return;
    }

    // Lightweight migration: add columns introduced after the initial schema
    const columns = await KnowledgeDb.raw("PRAGMA table_info(IndustryFacts)") as any[];
    const names = new Set((columns as any[]).map((c) => c.name));
    if (!names.has("region")) {
        await KnowledgeDb.raw("ALTER TABLE IndustryFacts ADD COLUMN region TEXT");
    }
    if (!names.has("qualifier")) {
        await KnowledgeDb.raw("ALTER TABLE IndustryFacts ADD COLUMN qualifier TEXT");
    }
}

EnsureIndustryFactsTable();