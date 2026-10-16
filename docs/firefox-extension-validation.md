# Firefox implementation validation

Validated locally on 2026-10-15. This records implementation checks, not AMO
approval or completion of every release gate.

## Automated checks and artifacts

- Repository lint and API/web TypeScript checks passed.
- API tests: 88 passed, one existing replication integration test skipped.
- Web tests: 100 passed across 20 files, including startup/cache regressions,
  native browser APIs, bridge validation/timeouts, scheduler recovery and
  notification failure, background-context recreation, and manifest generation.
- The aggregate build produced the website, Chrome extension, and Firefox
  extension. The final Firefox shortcut change was rebuilt and retested.
- Production extension builds used `https://shlk.cc` for API, public service,
  and website, with the existing Chrome store ID. Confirm these deployment
  values before distributing the generated packages.
- Both ZIPs passed CRC/integrity checks and contain a root manifest and all
  manifest assets. JavaScript chunk references were checked. The standalone
  bridge has no imports. No environment files, TypeScript sources, or source
  maps are included. No configured development endpoint remains; React Router
  retains its internal `http://localhost` URL-parsing fallback in vendor code.
- Outputs are in `apps/web/dist/releases`: `shlk-extension.zip`,
  `shlk-extension-firefox.zip`, `SHA256SUMS`, and `firefox-lint.json`.
- Docker is unavailable on this host, so the Docker artifact target itself was
  not executed. Equivalent native builds and ZIP contents were validated.

`web-ext@10.8.0 lint` on the final production Firefox output reported **zero
errors and four warnings**:

1. Android 140 does not support the data consent declaration. This target is
   desktop-only; select desktop platforms when submitting to AMO.
2. Two dynamic `innerHTML` assignments are in the bundled React DOM renderer.
   Application source does not use `innerHTML` or `dangerouslySetInnerHTML`.
3. The dynamic import warning is React Router's route-module loader in the
   vendor bundle. SHLK's route configuration uses local application components.

Retain these warnings for review; successful lint does not guarantee AMO approval.

## Existing Firefox Nightly session

Used the already-running Nightly 153.0 process; no second instance was launched.
It exposes a Playwright `-juggler-pipe`, with no attachable debugging listener.
Temporary installation through `about:debugging` and normal extension/page
developer tools allowed testing through the desktop UI.

Observed successfully:

- Temporary installation with ID `shlk@shlk.cc` and a generated installation UUID.
- Website protocol-v1 detection and scheduling through the content-script bridge.
- Alarm-driven restoration of a scheduled tab and subsequent server snooze
  cleanup, confirmed by querying the server from the website.
- Credentialed requests from the extension background and popup after signing
  into a normal tab with the nonproduction E2E login and disposable in-memory DB.
- Popup active-tab prefill, authenticated history, link creation, and Copy;
  pasting into the browser address bar confirmed the copied short URL.
- Extension reload with persisted local state.
- Firefox's commands API reports the Alt+Shift+S popup shortcut. Simulated VNC
  keystrokes did not reliably activate it, so actual keyboard activation remains
  a manual check; the toolbar popup works.

The Playwright-created container initially hid its login cookie from the extension
background. A normal-tab login confirmed session sharing without changing cookie
policy or CORS. Container-specific accounts remain out of scope.

## Remaining release gates

Use the checklist in [the release guide](firefox-extension-release.md). In
particular, stable/ESR and Chrome live regression tests, actual Google OAuth and
logout, popup paste, OS notification display, denied host permissions, offline
recovery, and background suspension/browser restart still require live checks.
Unit coverage is not a substitute for those checks. No add-on was signed,
submitted, or published.

The temporary add-on and disposable API process were removed/stopped after the
checks. The original Firefox process and pre-existing website server were left
running. Load `apps/web/dist/extension-firefox/manifest.json` again for local
development; the ZIPs use production origins.
