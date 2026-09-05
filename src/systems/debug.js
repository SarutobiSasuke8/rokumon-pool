export function installDebug(scene, getState) {
  window.__GAME_DEBUG__ = {
    startGame: () => scene.scene.start("Game"), snapshotState: () => getState(),
    stepFrames: (frames = 1, delta = 16.667) => { for (let i = 0; i < frames; i += 1) scene.game.loop.step(performance.now(), delta); },
    setSeed: (seed) => scene.registry.set("seed", seed)
  };
}
