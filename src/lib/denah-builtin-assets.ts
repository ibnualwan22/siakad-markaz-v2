import manifest from "../../public/models/markaz/manifest.json";
import type { SceneAsset } from "./denah-scene";

export const BUILTIN_ASSETS: SceneAsset[] = manifest.filter(asset => asset.id !== "builtin-character");
export const HOUSE_ASSETS = BUILTIN_ASSETS.filter(asset => asset.id.startsWith("builtin-house-"));
export const CHARACTER_URL = "/models/markaz/character.glb";

export function withBuiltinAssets(assets: SceneAsset[]) {
  return [...BUILTIN_ASSETS, ...assets.filter(asset => !BUILTIN_ASSETS.some(b => b.id === asset.id))];
}
