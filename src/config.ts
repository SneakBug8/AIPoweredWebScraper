import { FindMyIp } from "./util/FindMyIp";

class ConfigClass
{
  // ChatIds that don't require auth
  public AllowedChats = JSON.parse(process.env.allowedchats || "") as number[];
  // Chat where bot will send notifications
  public DefaultChat = Number.parseInt(process.env.defaultchat || "", 10) as number;

  public Password = process.env.password;

  public ilovepdfpublickey()
  {
    return process.env.ilovepdfpublickey;
  }

  public converterkey()
  {
    return process.env.converterkey;
  }

  public ilovepdfprivatekey()
  {
    return process.env.ilovepdfprivatekey;
  }

  public ftphost()
  {
    return process.env.ftphost;
  }

  public ftpuser()
  {
    return process.env.ftpuser;
  }

  public ftppassword()
  {
    return process.env.ftppassword;
  }

  public ftpbasepath()
  {
    return process.env.ftpbasepath;
  }

  public get(key: string) {
    if (process.env[key]) {
      return process.env[key];
    }

    throw new Error(`Requested key ${key} not present in Config`);
  }

  public basePath(): string
  {
    return __dirname;
  }

  public projectPath(): string
  {
    return __dirname + "/..";
  }

  public dataPath(): string
  {
    return __dirname + "/../data";
  }

  public port()
  {
    return 3000;
  }

  public CockpitURL()
  {
    return process.env.CockpitURL;
  }

  public CockpitToken()
  {
    return process.env.CockpitToken;
  }

  public KanbanURL()
  {
    return process.env.KanbanURL;
  }

  public KanbanToken()
  {
    return process.env.KanbanToken;
  }

  public isProduction()
  {
    return process.env.NODE_ENV === "production";
  }

  public isDev()
  {
    return !this.isProduction();
  }

  private testEnv = false;

  public setTest()
  {
    this.testEnv = true;
  }

  public isTest()
  {
    return this.testEnv;
  }

  public mtprotoApiID()
  {
    return process.env.mtprotoapiid;
  }

  public mtprotoApiHash()
  {
    return process.env.mtprotoapihash;
  }

  public mtprotoPhoneNumber()
  {
    return process.env.mtprotophone;
  }
}

export const Config = new ConfigClass();
