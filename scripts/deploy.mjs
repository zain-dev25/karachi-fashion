import { mkdir, writeFile } from "node:fs/promises";
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

const functionsDirectory = resolve(root, "functions");
await mkdir(functionsDirectory, { recursive: true });
await writeFile(resolve(functionsDirectory, `.env.${projectId}`), `ADMIN_EMAIL=${JSON.stringify(adminEmail)}\n`);

const result = spawnSync("npx", ["--yes", "firebase-tools", "deploy", "--project", projectId], {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;