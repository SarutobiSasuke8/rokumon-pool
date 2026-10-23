// HUD model: what each player's card and the pocketed-ball tray show, from
// the HUD payload the Game scene emits. Pure, so it can be checked in Node.

export const GROUP_BALLS = Object.freeze({
  solid: Object.freeze([1, 2, 3, 4, 5, 6, 7]),
  stripe: Object.freeze([9, 10, 11, 12, 13, 14, 15]),
});

export function groupLabel(suit) {
  if (suit === "solid") return "SOLIDS";
  if (suit === "stripe") return "STRIPES";
  return "OPEN TABLE";
}

// One card per player: name, group, which of the group's balls are still on
// the table, and whether the player is now on the 8-ball.
export function playerPanel(data, player) {
  const rawName = data.names?.[player] ?? `Player ${player}`;
  const name = player === 2 && data.difficultyLabel ? `${rawName} (${data.difficultyLabel})` : rawName;
  const group = data.assigned?.[player] ?? null;
  const remaining = group ? [...(data.remaining?.[group] ?? [])] : [];
  const balls = group ? GROUP_BALLS[group].map((id) => ({ id, onTable: remaining.includes(id) })) : [];
  const onEight = Boolean(group) && remaining.length === 0;
  return {
    player,
    name,
    group,
    label: onEight ? "ON THE 8" : groupLabel(group),
    remaining,
    balls,
    onEight,
    active: data.turn === player && !data.gameOver,
  };
}

export function playerPanels(data) {
  return [playerPanel(data, 1), playerPanel(data, 2)];
}

// Object balls in the order they dropped. The cue ball never goes in the
// tray (it comes back for ball in hand) and each ball appears once.
export function trayBalls(pocketed = []) {
  const out = [];
  pocketed.forEach((id) => {
    if (id === "cue" || out.includes(id)) return;
    out.push(id);
  });
  return out;
}
