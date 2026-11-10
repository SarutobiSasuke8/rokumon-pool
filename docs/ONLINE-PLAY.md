# Online play on Rokumon Games

Start with **Play Online → Create a Room / Join with a Code**. The host gets
an invite link; the second signed-in player joins the same table. Both confirm
they are ready and the server assigns the break. Start with casual 8-ball.
Once invites work, add **Find a Match**, one shared queue that pairs players
already looking for a game on Rokumon Games. No chat or rankings are needed
for either step.

## What exists

- The hub has accounts and server sessions. Reuse the signed-in account and
  display name; do not pass the session cookie into the game or put it in an
  invite link. A first-party room API can issue a short-lived, room-scoped
  connection ticket after it checks membership.
- Pool already has local two-player UI, four pure rule resolvers, a defined
  shot lifecycle and a debug snapshot. The browser currently owns the
  Matter simulation. There is no online room, queue, or remote turn sync.
- The hub bridge only reports game events. Keep it for activity reporting.
  The hub can display rooms and launch a game without importing its engine.

## What to build

1. **Rooms and presence.** Keep two seats per room, enforce distinct identities,
   expire unused codes, and show waiting, ready, in game and disconnected states.
   Make invites revocable and rate limit room creation and code guesses.
2. **Two-way connection.** Run a small same-origin WebSocket service behind
   the existing nginx proxy. Validate origin, ticket, membership and message
   size. Start with one process; Redis or equivalent coordination only
   becomes necessary if the room service scales to several instances.
3. **One table authority.** Extract the headless physics setup from the Pool
   scene and reuse the existing rule resolver on the service. A client sends
   placement or shot intent (angle, power, spin and expected turn sequence).
   The service rejects moves made out of turn, duplicated, or outside legal
   limits, steps the simulation and supplies the same authoritative settled
   positions, pots, foul, turn and result to both browsers. Stream movement
   or replay the shot locally for presentation and reconcile to the server
   snapshot. The game remains a static bundle on the hub.
4. **Reconnect and finish.** On refresh or a brief drop, reattach the same
   player and restore the last snapshot; after a stated grace period offer
   a forfeit or return to the lobby. A local pause or tab switch must never
   freeze the other player's connection. Persist the match result once.

Before shipping, test two separate signed-in browser sessions: create/join,
take alternating legal turns, award a foul, refresh mid-game, resume, reject a
third player and a stale shot, and finish with both clients showing the same
winner. Load test a handful of simultaneous tables on the existing VPS
before deciding whether the match service needs its own host.

Protocol references: [WebSocket handshake and origin checks](https://www.rfc-editor.org/rfc/rfc6455.html#section-4)
and [nginx WebSocket proxying and timeouts](https://nginx.org/en/docs/http/websocket.html).
