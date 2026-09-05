# Branded HUD Housing

Use DOM overlays for text-heavy or accessibility-sensitive interfaces. When a
Phaser game deliberately uses in-canvas, raster-themed HUD frames, treat the
frame's usable interior as authored asset metadata rather than guessing offsets
from the PNG edges.

## The contract

Each wrapper asset must define normalized safe insets:

```js
const HUD_FRAMES = {
  "hud-frame": { left: 0.12, right: 0.12, top: 0.21, bottom: 0.23 },
};
```

The values describe the portion excluded from content. They must omit blades,
rope, posts, roof beams, crests, shadows, and transparent padding. Replacing or
recropping a wrapper means remeasuring this metadata before moving labels.

`profiles/phaser-js/src/ui/UIHousing.js` preserves the image aspect ratio,
calculates the safe rectangle, exposes normalized `(u, v)` layout points, tracks
child bounds, audits overflow, and draws a visual guide.

```js
import { UIHousing, auditHousings, drawHousingGuides } from "../ui/UIHousing.js";

const housing = new UIHousing(this, {
  key: "hud-frame",
  x: 220,
  y: 44,
  width: 410,
  safeInsets: HUD_FRAMES["hud-frame"],
  depth: 9,
});

const scorePosition = housing.point(0, 0.5);
const score = housing.track(
  this.add.text(scorePosition.x, scorePosition.y, "000000").setOrigin(0, 0.5),
  "score",
);

const housings = [housing];
this.time.delayedCall(0, () => {
  const violations = auditHousings(housings);
  if (violations.length) console.warn("UI housing overflow", violations);
});

const guide = this.add.graphics().setDepth(1000).setVisible(false);
let guideVisible = false;
this.input.keyboard.on("keydown-F2", () => {
  guideVisible = !guideVisible;
  drawHousingGuides(guide, housings, guideVisible);
});
```

Guide colours are:

- Magenta: complete raster bounds.
- Cyan: authored content-safe rectangle.
- Yellow: tracked child bounds.

## Acceptance gate

1. Test ordinary and maximum realistic values, including long level names,
   maximum score/time, and localized text when localization is supported.
2. Fail automated browser QA when any tracked child exceeds its safe rectangle.
3. Capture desktop and smallest-supported mobile screenshots.
4. Review the screenshot as well as the geometry. A bad safe-area declaration
   can pass containment while still placing content over ornament.
5. Keep the centre and lower-middle playfield clear during normal play.

For DOM HUDs, use the same contract with a content wrapper and CSS padding or
custom properties; the Phaser helper itself is not required.
