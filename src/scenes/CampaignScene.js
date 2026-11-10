import Phaser from "phaser";
import { VARIANT_INFO } from "../game/state.js";
import { audio } from "../systems/audio.js";
import { CHARACTERS, goldCount, loadCampaign, opponentData, trophyCount, unlockedCount } from "../systems/campaign.js";
import { FONT, UI, VIEW, addButton, addText, addTitle, drawRokumon, setupCamera } from "../ui/theme.js";
import { addPortrait, addTrophy } from "../ui/collectibles.js";

// The ladder: ten cards in two rows. Beaten opponents show their trophy,
// the next one is open, the rest are locked. Tap a card to read about the
// opponent, then PLAY.
const CARD = { w: 168, h: 168, gap: 8, left: 44, top: 74, rowGap: 10 };

function drawLock(g, x, y, size, color) {
  g.lineStyle(size * 0.16, color, 1);
  g.strokeCircle(x, y - size * 0.28, size * 0.26);
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - size * 0.42, y - size * 0.2, size * 0.84, size * 0.62, 3);
}

export class CampaignScene extends Phaser.Scene {
  constructor() { super("Campaign"); }

  create() {
    setupCamera(this);
    document.body.dataset.screen = "campaign";
    if (this.textures.exists("table")) this.add.image(VIEW.w / 2, VIEW.h / 2, "table").setDisplaySize(VIEW.w, VIEW.h);
    this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x05070b, 0.9);

    this.progress = loadCampaign();
    this.open = unlockedCount(this.progress);
    const won = trophyCount(this.progress);
    const gold = goldCount(this.progress);

    const head = this.add.graphics();
    drawRokumon(head, 62, 38, 4.2, UI.brass, 0.95);
    addTitle(this, 92, 38, "CAMPAIGN", { fontSize: "32px", color: UI.css.brass }).setOrigin(0, 0.5);
    addText(this, 236, 41, "THE TEN BRAVES", { fontFamily: FONT.display, fontStyle: "600", fontSize: "15px", color: UI.css.dim }).setOrigin(0, 0.5);
    addText(this, 916, 30, `${won} / ${CHARACTERS.length} TROPHIES`, { fontFamily: FONT.display, fontStyle: "700", fontSize: "17px", color: UI.css.cream }).setOrigin(1, 0.5);
    addText(this, 916, 50, gold ? `${gold} gold (won without a foul)` : "Win without a foul for gold", { fontSize: "11px", color: UI.css.dim }).setOrigin(1, 0.5);

    this.cardGfx = this.add.graphics();
    this.cards = CHARACTERS.map((c, i) => this.buildCard(c, i));

    // Detail bar for the selected opponent.
    this.detailGfx = this.add.graphics();
    this.detailName = addTitle(this, 56, 452, "", { fontSize: "24px" }).setOrigin(0, 0.5);
    this.detailMeta = addText(this, 56, 476, "", { fontFamily: FONT.display, fontStyle: "600", fontSize: "13px", color: UI.css.brass }).setOrigin(0, 0.5);
    this.detailBlurb = addText(this, 56, 500, "", { fontSize: "13px", color: UI.css.cream, wordWrap: { width: 560 } }).setOrigin(0, 0.5);
    this.playButton = addButton(this, 826, 476, 170, 48, "PLAY", () => this.play(), { primary: true, fontSize: 22 });
    addButton(this, 676, 476, 110, 40, "BACK", () => this.scene.start("Menu"), { fontSize: 17 });

    this.select(Math.min(this.open - 1, CHARACTERS.length - 1));
    const keys = this.input.keyboard;
    keys.on("keydown-ESC", () => this.scene.start("Menu"));
    keys.on("keydown-LEFT", () => this.select(Math.max(0, this.selected - 1)));
    keys.on("keydown-RIGHT", () => this.select(Math.min(CHARACTERS.length - 1, this.selected + 1)));
    keys.on("keydown-SPACE", () => this.play());
    keys.on("keydown-ENTER", () => this.play());
  }

  cardBox(i) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    return { x: CARD.left + col * (CARD.w + CARD.gap), y: CARD.top + row * (CARD.h + CARD.rowGap) };
  }

  buildCard(c, i) {
    const { x, y } = this.cardBox(i);
    const cx = x + CARD.w / 2;
    const locked = i >= this.open;
    const beaten = this.progress.beaten[c.id];
    const portrait = addPortrait(this, c.id, cx, y + 55, 86);
    portrait?.setAlpha(locked ? 0.57 : 1);
    if (beaten) addTrophy(this, x + CARD.w - 24, y + 27, 42, beaten.gold);
    const small = { fontFamily: FONT.display, fontStyle: "600", fontSize: "11px", color: UI.css.dim };
    addTitle(this, x + 21, y + 26, String(c.rank).padStart(2, "0"), { fontSize: "16px", color: locked ? UI.css.dim : UI.css.brass }).setOrigin(0.5);
    addText(this, cx, y + 108, c.name.toUpperCase(), { fontFamily: FONT.display, fontStyle: "700", fontSize: "15px", color: locked ? UI.css.dim : UI.css.cream }).setOrigin(0.5);
    addText(this, cx, y + 125, locked ? "Locked" : c.epithet, { fontSize: "11px", color: UI.css.dim }).setOrigin(0.5);
    addText(this, cx, y + 148, VARIANT_INFO[c.variant].short, small).setOrigin(0.5);
    this.add.zone(cx, y + CARD.h / 2, CARD.w, CARD.h).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => { audio.unlock(); audio.ui(); this.select(i); });
    return { c, i };
  }

  select(i) {
    this.selected = i;
    const g = this.cardGfx.clear();
    this.cards.forEach(({ c, i: index }) => {
      const { x, y } = this.cardBox(index);
      const cx = x + CARD.w / 2;
      const locked = index >= this.open;
      const on = index === i;
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(x, y + 3, CARD.w, CARD.h, 12);
      g.fillStyle(on ? UI.panelLit : UI.panel, 0.97);
      g.fillRoundedRect(x, y, CARD.w, CARD.h, 12);
      g.lineStyle(on ? 2 : 1, on ? UI.brass : UI.line, 1);
      g.strokeRoundedRect(x, y, CARD.w, CARD.h, 12);

      g.fillStyle(c.color, 0.42);
      g.fillRoundedRect(cx - 46, y + 9, 92, 92, 5);
      g.lineStyle(1, on ? UI.brass : UI.line, 1);
      g.strokeRoundedRect(cx - 46, y + 9, 92, 92, 5);
      if (locked) drawLock(g, x + CARD.w - 22, y + 26, 16, 0x8793a1);

      // Game chip.
      g.fillStyle(0x0a0d12, 0.9);
      g.fillRoundedRect(cx - 42, y + 138, 84, 20, 10);
    });

    const c = CHARACTERS[i];
    const locked = i >= this.open;
    const beaten = this.progress.beaten[c.id];
    const d = this.detailGfx.clear();
    d.fillStyle(UI.panel, 0.97);
    d.fillRoundedRect(40, 430, 880, 96, 12);
    d.lineStyle(1.5, UI.brassDark, 1);
    d.strokeRoundedRect(40, 430, 880, 96, 12);
    if (locked) {
      this.detailName.setText(`${c.rank}. ${c.name.toUpperCase()}`).setColor(UI.css.dim);
      this.detailMeta.setText("LOCKED");
      this.detailBlurb.setText(`Beat ${CHARACTERS[this.open - 1].name} to meet this opponent.`);
    } else {
      this.detailName.setText(`${c.rank}. ${c.name.toUpperCase()}`).setColor(UI.css.cream);
      const trophy = beaten ? `${beaten.gold ? "GOLD" : "BRONZE"} ${c.trophy.toUpperCase()} WON` : `TROPHY: ${c.trophy.toUpperCase()}`;
      this.detailMeta.setText(`${c.epithet.toUpperCase()}  ·  ${VARIANT_INFO[c.variant].short}  ·  ${trophy}`);
      this.detailBlurb.setText(c.blurb);
    }
    this.playButton.setVisible(!locked).setLabel(beaten ? "REMATCH" : "PLAY");
  }

  play() {
    const c = CHARACTERS[this.selected];
    if (this.selected >= this.open) return;
    audio.unlock();
    this.scene.start("Game", { mode: "ai", variant: c.variant, opponent: opponentData(c) });
  }
}
