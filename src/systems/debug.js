export function installDebug(scene, getState) {
  window.__GAME_DEBUG__ = {
    startGame: (data) => scene.scene.start("Game", data),
    getScene: () => scene,
    // Resolves to a downscaled JPEG data URL of the current frame.
    snapshot: (width = 640, quality = 0.75) => new Promise((resolve) => {
      scene.game.renderer.snapshot((img) => {
        const c = document.createElement("canvas");
        const scale = width / img.width;
        c.width = width; c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      });
    }),
    snapshotState: () => getState(),
    // Deterministic stepping on virtual time, so tests do not depend on
    // requestAnimationFrame or a visible tab. The Matter runner is resynced
    // afterwards so the next real frame does not see a time jump.
    stepFrames: (frames = 1, delta = 16.667) => {
      const runner = scene.matter.world.runner;
      let t = runner.timeLastTick || performance.now();
      for (let i = 0; i < frames; i += 1) { t += delta; scene.game.step(t, delta); }
      runner.timeLastTick = 0;
    },
    shootCue: (angleDeg, power = 1) => scene.debugShoot?.(angleDeg, power),
    teleportToPocket: (id, pocketIndex = 0) => scene.debugTeleportToPocket?.(id, pocketIndex),
    placeCue: (x, y) => { scene.moveCueForPlacement?.(x, y); if (scene.placementValid) scene.confirmPlacement?.(); return scene.phase; },
    inspect: () => ({
      phase: scene.phase,
      mode: scene.mode,
      difficulty: scene.difficulty,
      aiTuning: scene.aiTuning?.(),
      waitingForRest: scene.waitingForRest,
      isDragging: scene.isDragging,
      firstContact: scene.firstContact,
      placementValid: scene.placementValid,
      pocketedThisTurn: scene.pocketedThisTurn,
      balls: [...scene.balls.entries()].map(([id, e]) => ({ id, active: e.active, sleeping: e.active ? e.body.isSleeping : null, speed: e.active ? e.body.speed : null, x: e.active ? e.body.position.x : null, y: e.active ? e.body.position.y : null })),
    }),
  };
}
