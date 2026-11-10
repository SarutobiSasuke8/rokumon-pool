import { UI } from "./theme.js";
import { characterById } from "../systems/campaign.js";

export function addPortrait(scene, id, x, y, size) {
  const character = characterById(id);
  return character && scene.textures.exists("braves")
    ? scene.add.image(x, y, "braves", character.rank - 1).setDisplaySize(size, size)
    : null;
}

export function addTrophy(scene, x, y, size, gold) {
  const key = gold ? "trophy-gold" : "trophy-bronze";
  return scene.textures.exists(key)
    ? scene.add.image(x, y, key).setDisplaySize(size, size)
    : scene.add.star(x, y, 5, size * 0.21, size * 0.42, gold ? UI.brass : 0xb9773a);
}
