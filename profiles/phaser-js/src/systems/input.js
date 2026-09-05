import Phaser from "phaser";
export function createActions(scene) {
  const keys = scene.input.keyboard.addKeys({ left: "LEFT", right: "RIGHT", confirm: "SPACE", pause: "ESC", restart: "R" });
  return { move: () => (keys.left.isDown ? -1 : 0) + (keys.right.isDown ? 1 : 0), confirmPressed: () => Phaser.Input.Keyboard.JustDown(keys.confirm), pausePressed: () => Phaser.Input.Keyboard.JustDown(keys.pause), restartPressed: () => Phaser.Input.Keyboard.JustDown(keys.restart) };
}
