#!/usr/bin/env node
/**
 * cloakbrowser-playwright-cli — stealth wrapper for @playwright/cli
 *
 * Transparent drop-in for @playwright/cli. Adds a single new flag:
 *
 *   playwright-cli open --stealth [url]
 *
 * When --stealth is present on an `open` or `attach` command this wrapper:
 *   1. Downloads the CloakBrowser stealth Chromium binary (cached, ~150 MB)
 *   2. Generates a temp playwright-cli config with executablePath + fingerprint args
 *   3. Strips --stealth from argv (unknown to official CLI)
 *   4. Injects --config=<tempfile> and forwards everything to @playwright/cli
 *
 * All other commands (click, type, snapshot, close, …) pass through unchanged.
 *
 * Env vars:
 *   CLOAKBROWSER_BINARY_PATH    — override binary path (skip auto-download)
 *   CLOAKBROWSER_HEADLESS=false — show browser window
 *   CLOAKBROWSER_PROXY          — proxy URL, e.g. http://user:pass@host:port
 *   CLOAKBROWSER_LOCALE         — locale, e.g. en-US
 *   CLOAKBROWSER_TIMEZONE       — timezone, e.g. America/New_York
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeSessionConfig, cleanupOldConfigs } from "./config.js";

const require = createRequire(import.meta.url);

/** Commands that start a new browser session and accept --config */
const SESSION_CMDS = new Set(["open", "attach"]);

// ─── Arg parsing ─────────────────────────────────────────────────────────────

interface ParsedArgs {
  command: string | undefined;
  stealth: boolean;
  hasConfig: boolean;
  headless: boolean;
  proxy: string | undefined;
  /** argv with --stealth removed, ready to forward to @playwright/cli */
  clean: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  let command: string | undefined;
  let stealth = false;
  let hasConfig = false;
  let headless = process.env.CLOAKBROWSER_HEADLESS?.toLowerCase() !== "false";
  let proxy: string | undefined = process.env.CLOAKBROWSER_PROXY;
  const clean: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    // Capture --stealth but don't forward it (unknown to official playwright-cli)
    if (arg === "--stealth") { stealth = true; continue; }

    if (!arg.startsWith("-") && !command) command = arg;
    if (arg === "--config" || arg.startsWith("--config=")) hasConfig = true;
    if (arg === "--headless") headless = true;
    if (arg === "--headed") headless = false;
    if (arg === "--proxy-server" && argv[i + 1]) proxy = argv[++i];
    if (arg.startsWith("--proxy-server=")) proxy = arg.split("=").slice(1).join("=");

    clean.push(arg);
  }

  return { command, stealth, hasConfig, headless, proxy, clean };
}

function parseProxy(url: string): { server: string; username?: string; password?: string } {
  try {
    const u = new URL(url);
    const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`;
    return {
      server,
      ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    };
  } catch {
    return { server: url };
  }
}

// ─── Locate @playwright/cli binary ───────────────────────────────────────────

function findPlaywrightCliBin(): string {
  try {
    const pkgJsonPath = require.resolve("@playwright/cli/package.json");
    const pkgDir = path.dirname(pkgJsonPath);
    const pkg = require("@playwright/cli/package.json") as { bin: Record<string, string> };
    const rel = pkg.bin["playwright-cli"] ?? "playwright-cli.js";
    return path.join(pkgDir, rel);
  } catch {
    throw new Error(
      "@playwright/cli not found.\n" +
      "Install it: npm install -g @playwright/cli\n" +
      "Or locally: npm install @playwright/cli"
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { command, stealth, hasConfig, headless, proxy, clean } = parseArgs(argv);

  let finalArgv = clean;

  if (stealth && command && SESSION_CMDS.has(command) && !hasConfig) {
    // Dynamic import — only loads cloakbrowser when stealth is actually requested
    const { ensureBinary, getDefaultStealthArgs } = await import("cloakbrowser");

    const executablePath = await ensureBinary();

    const args = getDefaultStealthArgs();

    const locale = process.env.CLOAKBROWSER_LOCALE;
    const timezone = process.env.CLOAKBROWSER_TIMEZONE;
    if (locale)    args.push(`--lang=${locale}`, `--fingerprint-locale=${locale}`);
    if (timezone)  args.push(`--fingerprint-timezone=${timezone}`);

    cleanupOldConfigs();
    const configPath = writeSessionConfig({
      executablePath,
      args,
      ignoreDefaultArgs: ["--enable-automation", "--enable-unsafe-swiftshader"],
      headless,
      ...(proxy ? { proxy: parseProxy(proxy) } : {}),
    });

    // Insert --config right after the command word
    const cmdIdx = clean.indexOf(command);
    finalArgv = [
      ...clean.slice(0, cmdIdx + 1),
      `--config=${configPath}`,
      ...clean.slice(cmdIdx + 1),
    ];
  }

  const cliBin = findPlaywrightCliBin();
  const child = spawn(process.execPath, [cliBin, ...finalArgv], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal as NodeJS.Signals);
    else process.exit(code ?? 0);
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
