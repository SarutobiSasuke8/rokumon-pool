import assert from "node:assert/strict";
import { hub } from "../src/integrations/hub.js";
for (const present of [true, false]) {
 const calls=[]; globalThis.window=present ? { Hub: Object.fromEntries(["ready","score","gameOver","event"].map(name=>[name,(...args)=>calls.push({name,args})])) } : {};
 hub.ready(); hub.score(present ? 7 : 8); hub.gameOver(7,42000); hub.event("match-won",{winner:1,mode:"ai",seconds:42});
 assert.equal(calls.length,present ? 4 : 0);
 if (present) assert.deepEqual(calls.map(c=>c.name),["ready","score","gameOver","event"]);
}
delete globalThis.window;
console.log("SDK forwarding and standalone no-op checks passed");
