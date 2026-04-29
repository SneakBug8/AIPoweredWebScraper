import express from "express";
import * as bodyParser from "body-parser";
import { Config } from "../config";
import * as ejs from "ejs";
import cookieParser from "cookie-parser";
import session from 'express-session';
import flash from 'connect-flash';

class WebApiClass {
  public app: express.Express;
  public constructor() {
    this.app = express();
    const port = Config.port();

    this.app.set("view engine", "ejs");
    this.app.set("views", Config.projectPath() + "/views");

    this.app.use(express.static(Config.projectPath() + "/public"));

    // app.use(cookieParser());
    this.app.use(bodyParser.urlencoded({ extended: false }));
    this.app.use(bodyParser.json());
    this.app.use(cookieParser());

    this.app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });

    this.app.use(session({
      secret: 'your-secret-key',
      resave: false,
      saveUninitialized: false
    }));
    this.app.use(flash());

    this.app.use((req, res, next) => {
      console.log(req.method + " to " + req.url);
      next();
    });

    this.app.use((req, res, next) => {
      if (req.query && req.query.password && req.query.password == Config.Password) {
        return next();
      }
      if (req.cookies && req.cookies.password && req.cookies.password == Config.Password) {
        return next();
      }

      if (req.cookies && req.cookies.password && req.cookies.password !== Config.Password) {
        return res.render("login", {
          err: "Wrong password"
        });
      }

      res.render("login", { err: "" });
    });

    this.app.get("/", (req, res) => {
      res.render("index");
    });
  }
}

export const WebApi = new WebApiClass();
