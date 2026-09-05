// Branded raster frames often include ornament and transparent padding that are
// not usable content space. UIHousing turns an asset-authored safe rectangle
// into normalized layout points and a runtime containment contract.
export class UIHousing {
  constructor(scene, {
    key,
    x,
    y,
    width,
    safeInsets,
    depth = 0,
    alpha = 1,
  }) {
    if (!safeInsets) throw new Error(`Missing UI safe insets for texture: ${key}`);
    const source = scene.textures.get(key).getSourceImage();
    const height = width * (source.height / source.width);

    this.key = key;
    this.frame = scene.add.image(x, y, key)
      .setDisplaySize(width, height).setDepth(depth).setAlpha(alpha);
    this.outer = {
      left: x - width / 2,
      top: y - height / 2,
      width,
      height,
    };
    this.outer.right = this.outer.left + width;
    this.outer.bottom = this.outer.top + height;
    this.safe = {
      left: this.outer.left + width * safeInsets.left,
      top: this.outer.top + height * safeInsets.top,
      width: width * (1 - safeInsets.left - safeInsets.right),
      height: height * (1 - safeInsets.top - safeInsets.bottom),
    };
    this.safe.right = this.safe.left + this.safe.width;
    this.safe.bottom = this.safe.top + this.safe.height;
    this.children = [];
  }

  point(u, v) {
    return {
      x: this.safe.left + this.safe.width * u,
      y: this.safe.top + this.safe.height * v,
    };
  }

  track(gameObject, name, tolerance = 1) {
    this.children.push({ gameObject, name, tolerance });
    return gameObject;
  }

  audit() {
    const violations = [];
    for (const { gameObject, name, tolerance } of this.children) {
      if (!gameObject?.active || !gameObject.getBounds) continue;
      const bounds = gameObject.getBounds();
      const overflow = {
        left: Math.max(0, this.safe.left - bounds.left),
        right: Math.max(0, bounds.right - this.safe.right),
        top: Math.max(0, this.safe.top - bounds.top),
        bottom: Math.max(0, bounds.bottom - this.safe.bottom),
      };
      if (Object.values(overflow).some((value) => value > tolerance)) {
        violations.push({ housing: this.key, name, bounds, safe: this.safe, overflow });
      }
    }
    return violations;
  }

  drawGuide(graphics) {
    graphics.lineStyle(1, 0xff4fd8, 0.9);
    graphics.strokeRect(this.outer.left, this.outer.top, this.outer.width, this.outer.height);
    graphics.lineStyle(2, 0x54e0e8, 1);
    graphics.strokeRect(this.safe.left, this.safe.top, this.safe.width, this.safe.height);
    graphics.lineStyle(1, 0xffd166, 0.9);
    for (const { gameObject } of this.children) {
      if (!gameObject?.active || !gameObject.getBounds) continue;
      const bounds = gameObject.getBounds();
      graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
  }
}

export function auditHousings(housings) {
  return housings.flatMap((housing) => housing.audit());
}

export function drawHousingGuides(graphics, housings, visible) {
  graphics.clear().setVisible(visible);
  if (!visible) return;
  housings.forEach((housing) => housing.drawGuide(graphics));
}
