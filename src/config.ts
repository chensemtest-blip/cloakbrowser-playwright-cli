/**
 * config.ts — Generate a playwright-cli daemon config file that points
 * to the CloakBrowser stealth binary with proper fingerprint args.
 *
 * The config file is written to a temp path and passed via `--config=<path>`
 * when starting a new playwright-cli browser session.
 *
 * Config schema matches playwright-core's MCP config format:
 *   browser.launchOptions.executablePath  — stealth Chromium binary
 *   browser.launchOptions.args            — fingerprint + stealth flags
 *   browser.launchOptions.ignoreDefaultArgs — strip automation-leaking defaults
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export interface StealthConfig {
  /** Absolute path to the CloakBrowser Chromium binary */
  executablePath: string;
  /** Stealth CLI args (includes randomised --fingerprint=SEED) */
  args: string[];
  /** Playwright default args to suppress */
  ignoreDefaultArgs: string[];
  /** Run headless (default: true) */
  headless?: boolean;
  /** Optional proxy */
  proxy?: { server: string; username?: string; password?: string };
}

/** Playwright-cli daemon config shape (subset we care about) */
interface PlaywrightCliConfig {
  browser: {
    browserName: "chromium";
    launchOptions: {
      executablePath: string;
      args: string[];
      ignoreDefaultArgs: string[];
      headless?: boolean;
      proxy?: { server: string; username?: string; password?: string };
    };
  };
}

/** Directory where we keep generated config files */
const CONFIG_DIR = path.join(os.homedir(), ".cloakbrowser-playwright-cli");

/**
 * Write a fresh playwright-cli config for a cloakbrowser session.
 * Returns the path to the written JSON file.
 *
 * A new file is created per `open` invocation so each browser gets a
 * freshly randomised fingerprint seed.
 */
export function writeSessionConfig(stealth: StealthConfig): string {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  const config: PlaywrightCliConfig = {
    browser: {
      browserName: "chromium",
      launchOptions: {
        executablePath: stealth.executablePath,
        args: stealth.args,
        ignoreDefaultArgs: stealth.ignoreDefaultArgs,
        ...(stealth.headless !== undefined ? { headless: stealth.headless } : {}),
        ...(stealth.proxy ? { proxy: stealth.proxy } : {}),
      },
    },
  };

  // Unique filename so concurrent sessions don't clobber each other
  const id = crypto.randomBytes(4).toString("hex");
  const filePath = path.join(CONFIG_DIR, `session-${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  return filePath;
}

/**
 * Clean up old session config files (older than 1 hour).
 * Called opportunistically — errors are silently ignored.
 */
export function cleanupOldConfigs(): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) return;
    const now = Date.now();
    for (const file of fs.readdirSync(CONFIG_DIR)) {
      if (!file.startsWith("session-") || !file.endsWith(".json")) continue;
      const full = path.join(CONFIG_DIR, file);
      try {
        const { mtimeMs } = fs.statSync(full);
        if (now - mtimeMs > 3_600_000) fs.unlinkSync(full);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
