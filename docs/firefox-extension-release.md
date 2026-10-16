# Build and test the Firefox extension

SHLK shares its React popup, GraphQL client, and snooze scheduler between Chrome
and Firefox. The Firefox artifact targets desktop Firefox 140 and later, including
supported ESR releases and Nightly. Its permanent add-on ID is `shlk@shlk.cc`.
Android and container-specific account handling are not supported.

## Development

Use Bun 1.3.14 and the locked dependencies. From the repository root:

```sh
bun run dev:extension:firefox
```

This starts the API and watches the Firefox build at
`apps/web/dist/extension-firefox`. Start the website separately with
`bun run --cwd apps/web dev` when testing website snoozing.

In the existing Firefox instance, open `about:debugging#/runtime/this-firefox`,
select **Load Temporary Add-on**, and choose the generated `manifest.json`.
The watch command does not reload Firefox automatically: use **Reload** after
manifest/background/bridge changes, then reload website tabs so the new content
script is injected. Temporary add-ons are removed when Firefox exits.

Use **Inspect** for extension logs and the toolbar's Extensions menu to open the
popup. Firefox's `_execute_action` defaults to **Alt+Shift+S** because Firefox
reserves Chrome's Ctrl+Shift+S shortcut for screenshots. Users can change it in
the add-on manager's **Manage Extension Shortcuts** screen; OS shortcuts can
still take precedence.

Do not use Chromium CDP tools to attach to Firefox. An existing Firefox process
must already expose an appropriate debugging endpoint to allow remote attachment.
A Playwright `-juggler-pipe` process is not a publicly attachable endpoint.
The temporary-add-on UI works without enabling browser-process remote debugging.

## Build interfaces

| Command | Output |
| --- | --- |
| `bun run build:extension:chrome` | `apps/web/dist/extension` |
| `bun run build:extension:firefox` | `apps/web/dist/extension-firefox` |
| `bun run build:extensions` | Both extension directories |
| `bun run build` | Website, both extensions, and API typecheck |

Existing `dev:extension` and `build:extension` commands retain Chrome behavior.
Vite uses `SHLK_EXTENSION_BROWSER=chrome|firefox` (default `chrome`) while keeping
its existing `extension` and `extension-development` environment modes. Explicit
browser scripts override this variable. Output cleanup affects only that browser.

The Firefox build does not require `EXTENSION_ORIGIN`; that remains Chrome's
website-messaging and API CORS setting. Never set it to the Firefox add-on ID or
an installation's random `moz-extension://` UUID.

Firefox uses host permissions for credentialed API requests from extension pages
and the background context. Keep session-cookie policy and the backend CORS
allowlist unchanged. Firefox match patterns omit ports; the content script and
background handler separately enforce the exact website origin, including port.
If a user revokes host access, API requests/website detection can fail until access
is restored. No wildcard extension-origin CORS rule is needed.

`storage.local` and popup local history belong to each browser independently.
Firefox `storage.sync` is tied to the Firefox add-on ID and Mozilla account; it
never shares Chrome Sync data. Authenticated SHLK data remains server-backed.
Sign in using a normal tab. Container tabs (including Playwright's named
containers) have separate session cookies that extension background requests do
not share; container-specific account handling is outside this implementation.

## Production package

Set public build values for the deployment being released. These are examples for
the canonical shlk.cc service; use the actual API/website origins if different:

```sh
VITE_BACKEND_URL=https://shlk.cc \
VITE_PUBLIC_SERVICE_URL=https://shlk.cc \
VITE_DISPLAY_SERVICE_URL=shlk.cc \
WEB_APP_URL=https://shlk.cc \
bun run build:extension:firefox

bunx web-ext@10.8.0 lint --source-dir apps/web/dist/extension-firefox
bunx web-ext@10.8.0 build \
  --source-dir apps/web/dist/extension-firefox \
  --artifacts-dir apps/web/dist/releases \
  --filename shlk-extension-firefox.zip --overwrite-dest
unzip -t apps/web/dist/releases/shlk-extension-firefox.zip
```

Set `VITE_FIREFOX_EXTENSION_STORE_URL` to the HTTPS AMO listing when it exists;
leave it empty beforehand. The website omits the Firefox install link while it is
empty. Rebuild the website when this value changes. `VITE_EXTENSION_STORE_URL`
continues to configure the separate Chrome link.

For an isolated Docker release (Docker must be installed):

```sh
docker build --target firefox-extension-artifact \
  --output type=local,dest=release \
  --build-arg VITE_BACKEND_URL=https://shlk.cc \
  --build-arg VITE_PUBLIC_SERVICE_URL=https://shlk.cc \
  --build-arg VITE_DISPLAY_SERVICE_URL=shlk.cc \
  --build-arg WEB_APP_URL=https://shlk.cc .
```

This exports `release/shlk-extension-firefox.zip`. Chrome's existing
`extension-artifact` target and `shlk-extension.zip` remain available.

Both builds derive version and common metadata from `apps/web/src/manifest.json`.
Increment that shared version before publishing an update. Firefox declares
required data categories for account/profile information, authenticated service
access, submitted URLs, and website content. These declarations describe existing
functionality; they do not add tracking. Keep the privacy policy and AMO listing
consistent with these categories. Firefox 140+ provides installation-time consent.

## Validation and release gate

See [the implementation validation record](firefox-extension-validation.md) for
completed checks, validator warnings, and remaining live-browser checks.

Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build`.
Use a supported modern Node runtime for Vitest. On Node versions exposing their
own experimental Web Storage, use `NODE_OPTIONS=--no-experimental-webstorage`
for tests so Vitest/jsdom supplies browser storage instead.

Validate the ZIP has `manifest.json` at its root, no `.env`/test/source files, and
only deployment URLs. Verify the popup, icon, background module, its imported
chunks, and the standalone content script are present. Run `web-ext lint` on the
exact production output and retain the ZIP checksum with its commit/version.

In Firefox and Chrome check:

- Popup prefill, anonymous and authenticated create/copy/paste, settings and history.
- Login in a normal browser tab, popup session recognition, and logout.
- Website extension detection, unavailable/retry guidance, and snoozing.
- Due-tab restoration, notifications, background suspension/recreation, and overdue
  restoration after browser restart; no duplicate restored tabs after API failure.
- Offline recovery, notification failure, and revoked API/website host permissions.
- Untrusted origins, wrong development ports, child frames, and invalid messages
  cannot schedule snoozes through the bridge.

Check supported stable/ESR releases as well as Nightly before release. Automated
unit tests and a successful temporary install alone do not establish full browser
compatibility. Google OAuth requires real deployment credentials; the existing
nonproduction E2E login can exercise sessions using disposable local data.

The ZIP is unsigned. AMO submission, signing, listing setup, and publication are
separate release steps. Retain the stable add-on ID across all future releases.
