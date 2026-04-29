import { MIS_DT } from "../util/MIS_DT";

export class Entity {
    public Id: undefined | number;
    public MIS_DT = MIS_DT.GetExact();
    public UPDATED_DT = MIS_DT.GetExact();
    public DELETED_DT: undefined | number;
}