import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { InvalidMove, advanceOnlineTable, rackOnlineTable } from "./online-table.mjs";

const token = Buffer.from(process.env.POOL_ENGINE_TOKEN ?? "");
const port = Number(process.env.POOL_ENGINE_PORT || 3492);
if (token.length < 24) throw new Error("Set POOL_ENGINE_TOKEN to a secret of at least 24 characters.");

function reply(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

const service = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/table") return reply(response, 404, {});
  const supplied = Buffer.from(request.headers.authorization ?? "");
  const expected = Buffer.concat([Buffer.from("Bearer "), token]);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(response, 401, {});
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 16_384) return reply(response, 413, { error: "Request too large." });
      chunks.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (input.operation === "rack") return reply(response, 200, { state: rackOnlineTable(), replay: [] });
    if (input.operation === "move" && [1, 2].includes(input.seat)) {
      return reply(response, 200, advanceOnlineTable(input.state, input.seat, input.move));
    }
    return reply(response, 400, { error: "Invalid table command." });
  } catch (error) {
    if (error instanceof InvalidMove) return reply(response, 409, { error: error.message });
    console.error("Pool engine request failed:", error instanceof Error ? error.message : "unknown error");
    return reply(response, 500, { error: "The table could not process the shot." });
  }
});

service.listen(port, "127.0.0.1", () => console.log(`Pool engine listening on 127.0.0.1:${port}`));
