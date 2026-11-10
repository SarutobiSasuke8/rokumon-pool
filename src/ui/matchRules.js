import { FOULS, RULE_GUIDE } from "../game/ruleGuide.js";
import { VARIANTS, VARIANT_INFO } from "../game/state.js";
import { loadSettings, saveSettings } from "../systems/settings.js";
import { FONT, UI, VIEW, addButton, addPoolLogo, addText, addTitle } from "./theme.js";

// Kept in the HUD scene so the table and the turn stay paused underneath it.
export function buildMatchRules(scene, { viewRules, dismiss, back }) {
  const titleStyle = { fontSize: "34px", color: UI.css.brass };
  const center = { align: "center", wordWrap: { width: 510 }, lineSpacing: 4 };
  const heading = { fontFamily: FONT.display, fontStyle: "700", fontSize: "14px", color: UI.css.brass };
  const button = { depth: 111, fontSize: 19 };
  const shade = scene.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x05070b, 0.82).setInteractive();
  const panel = scene.add.graphics();
  panel.fillStyle(UI.panel, 0.99);
  panel.lineStyle(1.5, UI.brassDark, 1);
  panel.fillRoundedRect(126, 36, 708, 476, 14);
  panel.strokeRoundedRect(126, 36, 708, 476, 14);
  const frame = scene.add.container(0, 0, [shade, panel, addPoolLogo(scene, 480, 65)]).setDepth(110);
  const startTitle = addTitle(scene, 480, 151, "", titleStyle).setOrigin(0.5);
  const startMessage = addText(scene, 480, 210, "", { ...center, fontSize: "21px" }).setOrigin(0.5);
  const box = scene.add.graphics();
  const boxLabel = addText(scene, 451, 278, "Don't ask again", { fontSize: "19px" }).setOrigin(0, 0.5);
  const boxHit = scene.add.zone(480, 278, 190, 44).setInteractive({ useHandCursor: true });
  const paintCheck = () => {
    box.clear();
    box.lineStyle(1.5, UI.brass, 1).strokeRoundedRect(421, 267, 22, 22, 4);
    if (loadSettings().hideRulesPrompt === true) {
      box.lineStyle(3, UI.brass, 1).lineBetween(426, 278, 430, 282).lineBetween(430, 282, 438, 273);
    }
  };
  boxHit.on("pointerup", (_p, _x, _y, event) => {
    event.stopPropagation();
    saveSettings({ hideRulesPrompt: loadSettings().hideRulesPrompt !== true });
    paintCheck();
  });
  const startContent = scene.add.container(0, 0, [startTitle, startMessage, box, boxLabel, boxHit]).setDepth(110.5);
  const startButtons = [
    addButton(scene, 377, 370, 184, 50, "VIEW RULES", viewRules, { ...button, primary: true }),
    addButton(scene, 583, 370, 184, 50, "START MATCH", dismiss, button),
  ];

  const ruleTitle = addTitle(scene, 480, 100, "MATCH RULES", titleStyle).setOrigin(0.5);
  const goal = addTitle(scene, 480, 182, "", { fontSize: "26px" }).setOrigin(0.5);
  const play = addText(scene, 164, 211, "", { fontSize: "17px", wordWrap: { width: 632 }, lineSpacing: 7 });
  const foulHeading = addText(scene, 164, 340, "FOULS", heading);
  const foul = addText(scene, 164, 362, "", { fontSize: "16px", color: UI.css.dim, wordWrap: { width: 632 }, lineSpacing: 4 });
  const ruleContent = scene.add.container(0, 0, [ruleTitle, goal, play, foulHeading, foul]).setDepth(110.5);
  const tabs = VARIANTS.map((key, i) => addButton(scene, 282 + i * 132, 141, 124, 34, VARIANT_INFO[key].short,
    () => select(key), { ...button, fontSize: 16 }));
  const backButton = addButton(scene, 480, 476, 232, 42, "", back, { ...button, primary: true });

  function select(key) {
    const rule = RULE_GUIDE[key];
    goal.setText(rule.goal);
    play.setText(rule.play.map((line) => `•  ${line}`).join("\n"));
    const foulY = play.y + play.height + 14;
    foulHeading.setY(foulY);
    foul.setY(foulY + 20).setText(`${FOULS}\n${rule.foul}`);
    tabs.forEach(({ text }, i) => text.setColor(VARIANTS[i] === key ? UI.css.brass : UI.css.cream));
  }

  function setMode(mode) {
    const start = mode === "start";
    const rules = mode === "rules";
    frame.setVisible(start || rules);
    startContent.setVisible(start);
    ruleContent.setVisible(rules);
    startButtons.forEach((b) => b.setVisible(start));
    [...tabs, backButton].forEach((b) => b.setVisible(rules));
  }
  setMode(null);

  return {
    showStart(variant) {
      startTitle.setText(VARIANT_INFO[variant].short);
      startMessage.setText(`${RULE_GUIDE[variant].goal}\nWould you like to see the rules before you break?`);
      paintCheck();
      setMode("start");
    },
    showRules(variant, beforeMatch) {
      select(variant);
      backButton.setLabel(beforeMatch ? "START MATCH" : "BACK TO PAUSE");
      setMode("rules");
    },
    hide() { setMode(null); },
  };
}
