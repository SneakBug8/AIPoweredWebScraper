import { MIS_DT } from "../util/MIS_DT";
import {Knex, knex} from "knex";
import { Entity } from "./Entity";
import { MapAsync } from "../util/MapAsync";

export class EntityFactory<T extends Entity> {
    public Connection: () => Knex.QueryBuilder;

    public constructor(repo: () => Knex.QueryBuilder) {
        // Soft removal functionality
        this.Connection = () => repo().where("DELETED_DT", null);
    }

    public async Parse(t: T) {
        return t;
    }

    public async Cleanup(t: T) {
        return t;
    }

    public async GetById(id: number) {
        const entries = await this.Connection().where("Id", "LIKE", `%${id}%`).select();

        if (entries.length) {
            return this.Parse(entries[0]);
        }
    }

    public async GetByName(name: string) {
        const entries = await this.Connection().where("name", "LIKE", `%${name}%`).select();

        if (entries.length) {
            return this.Parse(entries[0]);
        }
    }

    public async GetAll() {
        const entries = await this.Connection().select() as T[];
        const r = MapAsync.Map(entries, async (x) => await this.Parse(x));

        return r;
    }

    public async Delete(exercise: T) {
        exercise.DELETED_DT = MIS_DT.GetExact();
        await this.Update(exercise);
    }

    public async HardDelete(id: number) {
        await this.Connection().delete().where("Id", id);
    }

    public async Insert(exercise: T) {
        exercise = await this.Cleanup(exercise);
        exercise.MIS_DT = MIS_DT.GetExact();
        exercise.UPDATED_DT = MIS_DT.GetExact();
        const r = await this.Connection().insert(exercise);

        exercise.Id = r[0];
        return this.Parse(exercise);
    }

    public async Update(exercise: T) {
        exercise = await this.Cleanup(exercise);
        exercise.UPDATED_DT = MIS_DT.GetExact();
        await this.Connection().where("Id", exercise.Id).update(exercise);
        return this.Parse(exercise);
    }

    public async Count(): Promise<number> {
        const data = await this.Connection().count("Id as c").first() as any;

        if (data) {
            return data.c;
        }

        return 0;
    }
}