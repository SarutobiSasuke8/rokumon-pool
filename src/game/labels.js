// Player-facing name formatting. The rules module speaks in "Player N"; the
// scenes swap in the mode's names ("You", "Computer"). Pure, so it can be
// checked in Node.

// "You" takes "Your", everyone else takes "'s".
export function possessive(name) {
  return name === "You" ? "Your" : `${name}'s`;
}

// What a group is called in each game: blackball plays reds and yellows.
export function suitWord(suit, variant) {
  if (variant === "blackball") return suit === "solid" ? "red" : suit === "stripe" ? "yellow" : suit;
  return suit;
}

// HUD turn line, e.g. "Your turn · solids" or "Player 2's turn".
export function turnLabel(names, turn, suit, variant) {
  return `${possessive(names[turn])} turn${suit ? ` · ${suitWord(suit, variant)}s` : ""}`;
}

export function withNames(text, names) {
  let out = String(text || "");
  [1, 2].forEach((p) => {
    const name = names[p];
    if (name === "You") {
      out = out
        .replace(new RegExp(`Player ${p} pots and stays`, "g"), "You pot and stay")
        .replace(new RegExp(`Player ${p} pots and still has`, "g"), "You pot and still have")
        .replace(new RegExp(`Player ${p} has `, "g"), "You have ")
        .replace(new RegExp(`Player ${p} wins`, "g"), "You win")
        .replace(new RegExp(`Player ${p} breaks`, "g"), "You break");
    }
    out = out
      .replace(new RegExp(`Player ${p}'s`, "g"), possessive(name))
      .replace(new RegExp(`Player ${p}`, "g"), name);
  });
  return out;
}
