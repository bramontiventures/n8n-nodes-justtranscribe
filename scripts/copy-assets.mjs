// Copy node + credential icons into dist (no gulp — zero extra tooling).
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("dist/nodes/JustTranscribe", { recursive: true });
mkdirSync("dist/credentials", { recursive: true });
for (const f of ["justtranscribe.svg", "justtranscribe.dark.svg"]) {
  copyFileSync(`nodes/JustTranscribe/${f}`, `dist/nodes/JustTranscribe/${f}`);
  copyFileSync(`credentials/${f}`, `dist/credentials/${f}`);
}
console.log("icons copied");
