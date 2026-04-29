import { assert, expect } from "chai";
import { Auth, GetSecret } from "../api/Twitter";
import { ThreadLogger } from "../twitter-logger/ThreadLogger";
import { TwitterLogger } from "../twitter-logger/TwitterLogger";
import { IntervalsExecution } from "../util/IntervalsExecution";

describe("Twitter-Logger", function()
{
  /*it("Loads Tweets", async function()
  {
    await TwitterLogger.LoadTweets();
  }).timeout(10000);

  it("Loads Threads", async function()
  {
    await ThreadLogger.LoadThread("1506949543945904129");
  }).timeout(10000);*/

  /*it("Updates followers", async function()
  {
    await TwitterLogger.UpdateFollowers();
  }).timeout(10000);*/

  it("Auth", async function()
  {
    // await Auth();
  }).timeout(10000);
  it("Get Secret", async function()
  {
    // await GetSecret();
  }).timeout(10000);
});
