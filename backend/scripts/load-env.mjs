import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Load .env into process.env (Node scripts don't load it automatically).
 * Handles Windows CRLF and values that contain "=" (e.g. connection strings).
 */
export function loadEnv() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(scriptDir, "../.env"),
    resolve(process.cwd(), ".env"),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;

    const text = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const eq = line.indexOf("=");
      if (eq <= 0) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
    return envPath;
  }

  return null;
}
