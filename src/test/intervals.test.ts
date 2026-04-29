import { assert, expect } from "chai";
import { Server } from "..";
import { IntervalsExecution } from "../util/IntervalsExecution";

describe('Intervals', function ()
{
  it('finds intervals', async function ()
  {
    const d = "test" + Math.floor(Math.random() * 1000);

    const pexecuted = await IntervalsExecution.Executed(d);

    await IntervalsExecution.Execute(d);

    const executed = await IntervalsExecution.Executed(d);

    assert.equal(pexecuted, false);
    assert.equal(executed, true);
  });

  it('intervals 2', async function ()
  {
    const d = "test" + Math.floor(Math.random() * 1000);
    const d2 = "test2" + Math.floor(Math.random() * 1000);

    const pexecuted = await IntervalsExecution.Executed(d);

    await IntervalsExecution.Execute(d);
    await IntervalsExecution.Execute(d2);

    const executed = await IntervalsExecution.Executed(d);
    const executed2 = await IntervalsExecution.Executed(d2);


    assert.equal(pexecuted, false);
    assert.equal(executed, true);
    assert.equal(executed2, true);
  });
});