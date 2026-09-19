import { Connection, ConstructNamedConnection } from "../Database";
import { Entity } from "../entity/Entity";
import { EntityFactory } from "../entity/EntityFactory";

export class IndustryFact extends Entity {
  public topic = "";
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

export const IndustryFactsConnection = () => Connection<IndustryFact>("IndustryFacts");
export const IndustryFactRepository = new IndustryFactRepositoryClass(IndustryFactsConnection);
