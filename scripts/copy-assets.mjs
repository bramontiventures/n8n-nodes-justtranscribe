// Copy node icons into dist (no gulp — zero extra tooling).
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("dist/nodes/JustTranscribe", { recursive: true });
copyFileSync("nodes/JustTranscribe/justtranscribe.svg", "dist/nodes/JustTranscribe/justtranscribe.svg");
console.log("icons copied");
