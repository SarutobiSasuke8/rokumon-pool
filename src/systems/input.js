import Phaser from "phaser";
export function createRestartKey(scene) {
  const key = scene.input.keyboard.addKey("R");
  return { restartPressed: () => Phaser.Input.Keyboard.JustDown(key) };
}
