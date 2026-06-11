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
    proxy?: {
        server: string;
        username?: string;
        password?: string;
    };
}
/**
 * Write a fresh playwright-cli config for a cloakbrowser session.
 * Returns the path to the written JSON file.
 *
 * A new file is created per `open` invocation so each browser gets a
 * freshly randomised fingerprint seed.
 */
export declare function writeSessionConfig(stealth: StealthConfig): string;
/**
 * Clean up old session config files (older than 1 hour).
 * Called opportunistically — errors are silently ignored.
 */
export declare function cleanupOldConfigs(): void;
