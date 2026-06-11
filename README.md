# cloakbrowser-playwright-cli

> Drop-in wrapper for [`@playwright/cli`](https://playwright.dev/agent-cli/introduction) that adds a `--stealth` flag — powered by [CloakBrowser](https://cloakbrowser.dev), a source-patched Chromium that bypasses Cloudflare, DataDome, reCAPTCHA, hCaptcha, and other bot-detection systems.

## Install

```bash
npm install -g cloakbrowser-playwright-cli
```

That's it. This installs `playwright-cli` and `pwcli` commands globally.

## Usage

Identical to [`@playwright/cli`](https://playwright.dev/agent-cli/introduction) — just add `--stealth` to `open`:

```bash
# Open stealth browser (downloads CloakBrowser binary on first use, ~150 MB, cached)
playwright-cli open --stealth
playwright-cli open --stealth https://bot.sannysoft.com

# All other commands work unchanged
playwright-cli snapshot
playwright-cli click e5
playwright-cli fill e3 "hello@example.com"
playwright-cli type "search query"
playwright-cli press Enter
playwright-cli screenshot --filename=result.png
playwright-cli close
```

Without `--stealth`, commands are forwarded to the official `@playwright/cli` unchanged.

## What is stealth mode?

CloakBrowser is a patched Chromium binary with source-level fingerprint patches. It passes every major bot-detection test:

| Test | Standard Chrome | CloakBrowser |
|------|:-:|:-:|
| Cloudflare | ❌ blocked | ✅ passes |
| DataDome | ❌ blocked | ✅ passes |
| reCAPTCHA v3 | ❌ 0.1 score | ✅ 0.9 score |
| hCaptcha | ❌ challenged | ✅ passes |
| BrowserScan fingerprint | ❌ detected | ✅ undetected |
| `navigator.webdriver` | ❌ `true` | ✅ `undefined` |

Each session gets a randomly seeded fingerprint (hardware concurrency, device memory, GPU, screen size, WebGL) so sessions look distinct to trackers.

## Per-session config (optional)

Instead of `--stealth` on every command, set it in `.playwright/cli.config.json`:

```json
{
  "browser": {
    "stealth": true
  }
}
```

> **Note:** This requires the forked `playwright-core` build. For the npm package, use `--stealth` on the CLI.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLOAKBROWSER_BINARY_PATH` | auto | Override binary path, skips download |
| `CLOAKBROWSER_HEADLESS` | `true` | Set to `false` to show browser window |
| `CLOAKBROWSER_PROXY` | — | Proxy URL, e.g. `http://user:pass@host:port` |
| `CLOAKBROWSER_LOCALE` | — | Browser locale, e.g. `en-US` |
| `CLOAKBROWSER_TIMEZONE` | — | Timezone, e.g. `America/New_York` |

## How it works

```
playwright-cli open --stealth https://example.com
        │
        ▼
  cloakbrowser-playwright-cli (this package)
        │
        ├── strips --stealth from argv
        ├── calls ensureBinary() → downloads/caches CloakBrowser (~150 MB)
        ├── calls getDefaultStealthArgs() → --no-sandbox --fingerprint=XXXXX --fingerprint-platform=windows
        ├── writes temp config: { browser: { launchOptions: { executablePath, args, ignoreDefaultArgs } } }
        │
        ▼
  @playwright/cli open --config=/tmp/session-xxxx.json https://example.com
        │
        ▼
  CloakBrowser stealth Chromium (patched binary, randomised fingerprint)
```

The official `@playwright/cli` daemon reads the config and launches CloakBrowser instead of Chrome. All subsequent commands (`click`, `snapshot`, `type`, etc.) talk directly to the daemon — no wrapper overhead.

## Requirements

- Node.js ≥ 20
- ~150 MB disk for CloakBrowser binary (cached in `~/.cloakbrowser/`)

## Fork

This package is a thin wrapper. The underlying fork of `microsoft/playwright` with native `--stealth` support (no wrapper needed) is at:

**[github.com/chensemtest-blip/playwright](https://github.com/chensemtest-blip/playwright/tree/cloakbrowser-stealth)**

## License

MIT
