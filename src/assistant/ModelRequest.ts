import { ConstructNamedConnection } from "../Database.js";
import { Entity } from "../entity/Entity.js";
import { EntityFactory } from "../entity/EntityFactory.js";

// US14 Model request telemetry: every balancer request is logged with its provider, model,
// completion tokens and completion time (the basis for TPS/cost analytics in docs/usefulSQL.md).
// US14AC5 Logs live in a separate per-month database file (YYYYMM_ModelRequestLogs.db) so old
//         logs can be archived/removed independently from the main DB.
// US14AC10 The month connection is resolved lazily on each query and cached per month, so a month
//          rollover during a long-running process starts a fresh log file without re-creating or
//          re-backing-up the existing one.
export class ModelRequestLog extends Entity {
  public context = "";
  public prompt = "";
  public message = "";
  public reasoning = "";
  public tools = "";
  public provider = "ollama";
  public model = "";
  public conversationLength = 0;
  public completionTokens = 0;
  public completionTime = 0;
}

class ModelRequestLogRepositoryClass extends EntityFactory<ModelRequestLog> {
  public async GetLatest(count: number): Promise<ModelRequestLog[]> {
    await GetMonthConnection(currentMonthSuffix()).ready;
    const entries = await this.Connection()
      .orderBy("MIS_DT", "desc")
      .limit(count)
      .select() as ModelRequestLog[];
    return Promise.all(entries.map(x => this.Parse(x)));
  }

  public async GetAll(): Promise<ModelRequestLog[]> {
    await GetMonthConnection(currentMonthSuffix()).ready;
    return super.GetAll();
  }

  public async Insert(log: ModelRequestLog): Promise<ModelRequestLog> {
    await GetMonthConnection(currentMonthSuffix()).ready;
    return super.Insert(log);
  }

  public async Parse(t: ModelRequestLog): Promise<ModelRequestLog> {
    return t;
  }

  public async Cleanup(t: ModelRequestLog): Promise<ModelRequestLog> {
    return t;
  }
}

// Current month as YYYYMM (e.g. "202608"). Model request logs are split into a separate
// database file per month so old logs can be archived/removed independently from the main DB.
function currentMonthSuffix(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}${month}`;
}

async function EnsureModelRequestLogsTable(db: ReturnType<typeof ConstructNamedConnection>) {
  const exists = await db.schema.hasTable("ModelRequestLogs");
  if (!exists) {
    await db.schema.createTable("ModelRequestLogs", (table) => {
      table.increments("Id").primary();
      table.text("context");
      table.text("prompt");
      table.text("message");
      table.text("reasoning");
      table.text("tools");
      table.string("provider");
      table.string("model");
      table.integer("conversationLength");
      table.integer("completionTokens");
      table.integer("completionTime");
      table.integer("MIS_DT");
      table.integer("UPDATED_DT");
      table.integer("DELETED_DT");
    });
  }
  // US14 reasoning telemetry: the column was added after the per-month log tables shipped, so
  // migrate existing month DBs in place instead of recreating them.
  const hasReasoning = await db.schema.hasColumn("ModelRequestLogs", "reasoning");
  if (!hasReasoning) {
    await db.schema.alterTable("ModelRequestLogs", (table) => {
      table.text("reasoning");
    });
  }
}

type MonthConnection = {
  db: ReturnType<typeof ConstructNamedConnection>;
  ready: Promise<void>;
};

// Cache one knex instance per month so the database file isn't re-created/re-backed-up on every call.
const monthConnections = new Map<string, MonthConnection>();

function GetMonthConnection(suffix: string): MonthConnection {
  let entry = monthConnections.get(suffix);
  if (!entry) {
    // The current date (YYYYMM) is the prefix of the database file, e.g. "202608_ModelRequestLogs.db".
    const db = ConstructNamedConnection(`${suffix}_ModelRequestLogs`);
    entry = { db, ready: EnsureModelRequestLogsTable(db) };
    monthConnections.set(suffix, entry);
  }
  return entry;
}

// Model request logs live in a separate per-month database. Each query resolves the current
// month lazily, so a month rollover during a long-running process starts a fresh log file.
export const ModelRequestLogsConnection = () => {
  const entry = GetMonthConnection(currentMonthSuffix());
  return entry.db<ModelRequestLog>("ModelRequestLogs");
};
export const ModelRequestLogRepository = new ModelRequestLogRepositoryClass(ModelRequestLogsConnection);
