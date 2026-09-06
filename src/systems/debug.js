export function installDebug(scene, getState) {
  window.__GAME_DEBUG__ = {
    startGame: () => scene.scene.start("Game"),
    snapshotState: () => getState(),
    stepFrames: (frames = 1, delta = 16.667) => { for (let i = 0; i < frames; i += 1) scene.game.loop.step(performance.now(), delta); },
    shootCue: (angleDeg, power = 1) => scene.debugShoot?.(angleDeg, power),
    teleportToPocket: (id, pocketIndex = 0) => scene.debugTeleportToPocket?.(id, pocketIndex),
    inspect: () => ({
      waitingForRest: scene.waitingForRest,
      isDragging: scene.isDragging,
      pocketedThisTurn: scene.pocketedThisTurn,
      balls: [...scene.balls.entries()].map(([id, e]) => ({ id, active: e.active, speed: e.active ? e.body.speed : null, x: e.active ? e.body.position.x : null, y: e.active ? e.body.position.y : null })),
    }),
  };
}
