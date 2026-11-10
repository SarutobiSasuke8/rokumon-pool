import { VARIANT_INFO } from "./state.js";

const PUB_FOUL = "A foul gives your opponent 2 shots. If you pot the cue ball, it goes behind the line. Otherwise it stays put.";
const OWN_GROUP = "Hit your group first. Pot one legally to keep shooting, even if you have 2 shots.";

export const RULE_GUIDE = {
  eightball: {
    goal: "Clear your group, then pot the 8.",
    play: [
      "The first legal pot assigns solids and stripes.",
      OWN_GROUP,
      "Pot the 8 on a later shot after clearing your group. Pot it early or on a foul and you lose. If it drops on the break, it comes back.",
    ],
    foul: PUB_FOUL,
  },
  nineball: {
    goal: "Pot the 9 on a legal shot to win.",
    play: [
      "Always hit the lowest numbered ball still on the table first.",
      "Any legal pot keeps you at the table. A combination into the 9 can win at any time.",
      "If the 9 drops on a foul, it comes back onto the table.",
    ],
    foul: "A foul gives your opponent ball in hand. They can place the cue ball anywhere clear on the table.",
  },
  blackball: {
    goal: "Clear your colour, then pot the black.",
    play: [
      "The first legal pot assigns reds and yellows.",
      OWN_GROUP,
      "Pot the black on a later shot after clearing your colour. Pot it early or on a foul and you lose. If it drops on the break, it comes back.",
    ],
    foul: PUB_FOUL,
  },
  sixcoins: {
    goal: "Bank 4 gold coins to win.",
    play: [
      "Start on red. Pot a red to bring gold on for your next shot.",
      "Hit gold first and pot a coin to bank it, then go back to red. Return any coins potted on red or on a foul.",
      "With no reds left, gold is always on. At 3 coins each, the last coin goes back on the table to decide the match.",
    ],
    foul: PUB_FOUL,
  },
};

export const FOULS = "A foul means potting the cue ball, missing every ball, or hitting the wrong ball first.";

export const guideCard = (key) => ({
  title: VARIANT_INFO[key].short,
  gold: key === "sixcoins",
  lines: [RULE_GUIDE[key].goal, RULE_GUIDE[key].play[0], RULE_GUIDE[key].foul],
});
