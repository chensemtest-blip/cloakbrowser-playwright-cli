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
export {};
