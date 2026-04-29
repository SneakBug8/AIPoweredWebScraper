import { WebApi } from "../api/web";
import * as express from "express";
import { PriceRecord, PriceRecordRepository } from "./PriceRecord";
import { isNumeric, isLength, isISO8601 } from "validator";

class PriceRecordWebServiceClass {
  public Init() {
    WebApi.app.get("/prices", this.OnPrices.bind(this));
    WebApi.app.get("/prices/report", this.OnPriceReport.bind(this));
    WebApi.app.get("/price/:id", this.OnPrice.bind(this));
    WebApi.app.post("/prices/add", this.OnAddPrice.bind(this));
    WebApi.app.post("/price/:id/update", this.OnUpdatePrice.bind(this));
    WebApi.app.get("/price/:id/delete", this.OnDeletePrice.bind(this));
  }

  public async RenderPrices(req: express.Request, res: express.Response, context: object = {}) {
    (context as any).prices = await PriceRecordRepository.GetAll();
    return res.render("prices/prices", context);
  }

  public async RenderPrice(req: express.Request, res: express.Response, priceRecord: PriceRecord, context: object = {}) {
    (context as any).price = priceRecord;
    return res.render("prices/price", context);
  }

  public async OnPrices(req: express.Request, res: express.Response) {
    return await this.RenderPrices(req, res);
  }

  public async OnPriceReport(req: express.Request, res: express.Response) {
    const prices = await PriceRecordRepository.GetCheapestByCategory();
    return res.render("prices/prices_report", { prices });
  }

  public async OnPrice(req: express.Request, res: express.Response) {
    const id = req.params.id;

    if (!id || !isNumeric(id)) {
      return await this.RenderPrices(req, res, { error: "Invalid id" });
    }
    const priceRecord = await PriceRecordRepository.GetById(Number.parseInt(id, 10));

    if (!priceRecord) {
      return await this.RenderPrices(req, res, { error: "No such price record" });
    }

    return await this.RenderPrice(req, res, priceRecord);
  }

  private async OnAddPrice(req: express.Request, res: express.Response) {
    const input = req.body as PriceRecord;

    if (!isLength(input.category, { min: 1 }) || !isLength(input.shop, { min: 1 }) ||
        !isLength(input.commodity, { min: 1 }) || !isNumeric(input.price + "") ||
        !isNumeric(input.volume + "") || !isLength(input.unit, { min: 1 })) {
      return await this.RenderPrices(req, res, { message: "Bad content" });
    }

    const c = new PriceRecord();
    c.category = input.category;
    c.shop = input.shop;
    c.commodity = input.commodity;
    c.price = parseFloat(input.price + "");
    c.volume = parseFloat(input.volume + "");
    c.unit = input.unit;
    if (input.MIS_DT && isISO8601(input.MIS_DT + "")) {
      c.MIS_DT = new Date(input.MIS_DT).getTime();
    }

    const r = await PriceRecordRepository.Insert(c);
    return await this.RenderPrices(req, res, { message: `Successfully inserted new entry with ID ${r.Id}` });
  }

  private async OnUpdatePrice(req: express.Request, res: express.Response) {
    const id = req.params.id;
    const input = req.body as PriceRecord;

    if (!isNumeric(id) || !isLength(input.category, { min: 1 }) || !isLength(input.shop, { min: 1 }) ||
        !isLength(input.commodity, { min: 1 }) || !isNumeric(input.price + "") ||
        !isNumeric(input.volume + "") || !isLength(input.unit, { min: 1 })) {
      return await this.RenderPrices(req, res, { error: "Bad content" });
    }

    const priceRecord = await PriceRecordRepository.GetById(parseInt(id, 10));

    if (!priceRecord) {
      return await this.RenderPrices(req, res, { error: "No such price record" });
    }

    priceRecord.category = input.category;
    priceRecord.shop = input.shop;
    priceRecord.commodity = input.commodity;
    priceRecord.price = parseFloat(input.price + "");
    priceRecord.volume = parseFloat(input.volume + "");
    priceRecord.unit = input.unit;
    if (input.MIS_DT && isISO8601(input.MIS_DT + "")) {
      priceRecord.MIS_DT = new Date(input.MIS_DT).getTime();
    }

    const newd = await PriceRecordRepository.Update(priceRecord);

    return await this.RenderPrice(req, res, newd, { message: `Successfully updated entry with ID ${id}` });
  }

  private async OnDeletePrice(req: express.Request, res: express.Response) {
    const id = req.params.id;

    if (!id || !isNumeric(id)) {
      return await this.RenderPrices(req, res, { error: "Bad content" });
    }

    const Id = parseInt(id + "", 10);
    const priceRecord = await PriceRecordRepository.GetById(Id);

    if (!priceRecord) {
      return await this.RenderPrices(req, res, { error: "No such price record" });
    }

    await PriceRecordRepository.Delete(priceRecord);
    return await this.RenderPrices(req, res, { message: "Successfully deleted" });
  }
}

export const PriceRecordWebService = new PriceRecordWebServiceClass();
