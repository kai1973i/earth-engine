#!/usr/bin/env node
/**
 * Enforces the initial JS budget from docs/architecture.md. MapLibre dominates
 * the bundle, so the budget sits at 1.7 MB minified; anything above that means
 * a new dependency or a duplicated bundle needs to be investigated.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ASSETS = "apps/web/dist/assets";
const BUDGET_BYTES = 1_700_000;

if (!existsSync(ASSETS)) {
  console.error(`No build found at ${ASSETS}. Run "pnpm build" first.`);
  process.exit(1);
}

const files = readdirSync(ASSETS).filter((file) => file.endsWith(".js"));
const total = files.reduce((sum, file) => sum + statSync(join(ASSETS, file)).size, 0);

for (const file of files.sort()) {
  const size = statSync(join(ASSETS, file)).size;
  console.log(`${file.padEnd(44)} ${(size / 1024).toFixed(1)} kB`);
}
console.log(`\nTotal JS: ${(total / 1024).toFixed(1)} kB (budget ${(BUDGET_BYTES / 1024).toFixed(0)} kB)`);

if (total > BUDGET_BYTES) {
  console.error("Bundle budget exceeded. See docs/architecture.md#performance-budgets.");
  process.exit(1);
}
