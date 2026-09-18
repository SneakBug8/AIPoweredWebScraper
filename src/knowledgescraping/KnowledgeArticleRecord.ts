import { ConstructNamedConnection } from "../Database";
import { Entity } from "../entity/Entity";
import { EntityFactory } from "../entity/EntityFactory";

export class KnowledgeArticle extends Entity {
  public title = "";
  public author = "";
  public summary = "";
  public contentMd = "";
  public published = "";
  public shop = "";
  public source = "";
}

class KnowledgeArticleRepositoryClass extends EntityFactory<KnowledgeArticle> {
  public async GetLatest(count: number): Promise<KnowledgeArticle[]> {
    const entries = await this.Connection()
      .orderBy("MIS_DT", "desc")
      .limit(count)
      .select() as KnowledgeArticle[];
    return Promise.all(entries.map(x => this.Parse(x)));
  }

  public async GetWithSource(source: string): Promise<KnowledgeArticle> {
    const entry = await this.Connection()
      .where("source", source)
      .select().first() as KnowledgeArticle;
    return this.Parse(entry);
  }

  public async Parse(t: KnowledgeArticle): Promise<KnowledgeArticle> {
    return t;
  }

  public async Cleanup(t: KnowledgeArticle): Promise<KnowledgeArticle> {
    return t;
  }
}

export const KnowledgeDb = ConstructNamedConnection("knowledge");
export const KnowledgeArticlesConnection = () => KnowledgeDb<KnowledgeArticle>("KnowledgeArticles");
export const KnowledgeArticleRepository = new KnowledgeArticleRepositoryClass(KnowledgeArticlesConnection);

export async function EnsureKnowledgeArticlesTable() {
    const exists = await KnowledgeDb.schema.hasTable("KnowledgeArticles");
    if (!exists) {
        await KnowledgeDb.schema.createTable("KnowledgeArticles", (table) => {
            table.increments("Id").primary();
            table.text("title");
            table.text("author");
            table.text("summary");
            table.text("contentMd");
            table.text("published");
            table.text("shop");
            table.text("source");
            table.integer("MIS_DT");
            table.integer("UPDATED_DT");
            table.integer("DELETED_DT");
        });
    }
}

EnsureKnowledgeArticlesTable();