import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";

const root = process.cwd();
const env = loadEnv("production", root, "");
const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim();
const adminEmail = env.VITE_ADMIN_EMAIL?.trim();

if (!projectId || !/^[a-z0-9-]+$/.test(projectId)) {
  throw new Error("Set VITE_FIREBASE_PROJECT_ID in the root .env file before deploying.");
}
if (!adminEmail || !adminEmail.includes("@")) {
  throw new Error("Set VITE_ADMIN_EMAIL in the root .env file before deploying.");
}

const rulesTemplate = await readFile(resolve(root, "firestore.rules"), "utf8");
if (!rulesTemplate.includes("'__ADMIN_EMAIL__'")) {
  throw new Error("Admin email placeholder is missing from firestore.rules.");
}
const escapedAdminEmail = adminEmail.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
const generatedRules = rulesTemplate.replaceAll("__ADMIN_EMAIL__", escapedAdminEmail);
await writeFile(resolve(root, "firestore.rules.generated"), generatedRules);

if (process.argv.includes("--dry-run")) {
  console.log(`Generated Firestore Rules for ${projectId}; no deployment was started.`);
  process.exit(0);
}

const result = spawnSync("npx", ["--yes", "firebase-tools", "deploy", "--only", "hosting,firestore:rules", "--project", projectId], {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;