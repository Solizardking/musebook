// Post-build fixup: the CJS build emits to dist-cjs/, we ship it as dist/index.cjs.
import { renameSync, rmSync, existsSync } from "node:fs";

const src = new URL("../dist-cjs/index.js", import.meta.url);
const dest = new URL("../dist/index.cjs", import.meta.url);

if (!existsSync(src)) {
  console.error("fixup: dist-cjs/index.js missing — did tsc fail?");
  process.exit(1);
}
renameSync(src, dest);
rmSync(new URL("../dist-cjs/", import.meta.url), { recursive: true, force: true });
console.log("fixup: dist/index.cjs ready");
