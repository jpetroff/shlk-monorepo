# Build and publish the Chrome extension

This guide covers the SHLK Manifest V3 extension in `apps/web`: developing it
locally, creating a production ZIP, validating the ZIP, and uploading a new
version to the Chrome Web Store.

The release artifact contains only the extension. It does not contain the API
or website, and it must be built again whenever a public build variable changes.

## Prerequisites

- Bun 1.3.14 and the repository dependencies installed with
  `bun install --frozen-lockfile`.
- Chrome or another Chromium browser for local testing.
- Docker with BuildKit for the recommended release build.
- Access to the extension in the
  [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole).
- The production website URL, API URL, and existing Chrome Web Store item ID.

Run all commands from the repository root.

## Develop and test an unpacked extension

Start the API and watched extension build:

```sh
bun run dev:extension
```

The first build creates `apps/web/dist/extension`. In Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose `apps/web/dist/extension`.
4. Copy the assigned extension ID and set this value in the ignored root `.env`:

   ```dotenv
   EXTENSION_ORIGIN=chrome-extension://<extension-id>
   ```

5. Restart `bun run dev:extension` so the API accepts credentialed requests from
   that origin.

The watched build updates files on disk but does not reload the installed
extension. Reopen the popup for popup-only changes. Select **Reload** on
`chrome://extensions` after service-worker or manifest changes. Use the
service-worker link on that page to inspect background logs.

## Prepare a release

Before building:

1. Run the complete project gate:

   ```sh
   bun run lint
   bun run typecheck
   bun run test
   ```

2. Update `version` in `apps/web/src/manifest.json`. Chrome accepts one to four
   dot-separated integers, each from 0 through 65535. The new version must be
   greater than the version already uploaded to the store.
3. Confirm the source manifest contains all required store metadata: `name`,
   `version`, `description`, and `icons`. Chrome limits `description` to 132
   characters. Add any missing metadata before a first submission; the dashboard
   cannot add or change these fields after the ZIP is uploaded.
4. Review all permissions in the source manifest. Keep only permissions needed
   by the current release and make sure the store's Privacy practices
   declarations explain them.
5. Confirm the production values below. These values are compiled into the
   extension and are not runtime configuration.

| Build value | Release meaning |
| --- | --- |
| `VITE_BACKEND_URL` | HTTPS API origin. The build turns this into the extension's only `host_permissions` entry. |
| `VITE_PUBLIC_SERVICE_URL` | Public base URL used to construct short links. |
| `VITE_DISPLAY_SERVICE_URL` | Human-readable short-link host displayed in the UI. |
| `VITE_EXTENSION_STORE_URL` | Public URL of the existing Chrome Web Store listing. |
| `WEB_APP_URL` | HTTPS website origin allowed by `externally_connectable`. |
| `EXTENSION_ORIGIN` | `chrome-extension://` followed by the existing listing's 32-character item ID. |

The API deployment must use the same `EXTENSION_ORIGIN`, or authenticated
extension requests will be rejected by CORS. The production website must also
be rebuilt with that stable ID for website-to-extension messaging.

For a first-time store listing, Chrome assigns the item ID when the item is
created. Treat the first upload as a bootstrap package, record the assigned ID,
then configure `EXTENSION_ORIGIN` consistently for the API, website, and later
extension releases.

## Build the upload ZIP with Docker

The `extension-artifact` target performs a clean dependency install, requires
all public build values, rejects non-HTTPS release URLs, builds the project, and
exports `release/shlk-extension.zip`:

```sh
docker build \
  --target extension-artifact \
  --output type=local,dest=release \
  --build-arg VITE_BACKEND_URL=https://shlk.example \
  --build-arg VITE_PUBLIC_SERVICE_URL=https://shlk.example \
  --build-arg VITE_DISPLAY_SERVICE_URL=shlk.example \
  --build-arg VITE_EXTENSION_STORE_URL=https://chrome.google.com/webstore/detail/shlkcc-url-shortener/bjkhbppdemdfngnceocjmeapcfckfkok \
  --build-arg WEB_APP_URL=https://shlk.example \
  --build-arg EXTENSION_ORIGIN=chrome-extension://bjkhbppdemdfngnceocjmeapcfckfkok \
  .
```

Replace every example value. Do not upload an artifact built with localhost,
placeholder domains, or a development extension ID.

The Dockerfile changes into `apps/web/dist/extension` before creating the ZIP,
so `manifest.json` is at the archive root as required by the Chrome Web Store.

## Optional local production build

For a faster pre-release inspection, build only the extension locally:

```sh
VITE_BACKEND_URL=https://shlk.example \
VITE_PUBLIC_SERVICE_URL=https://shlk.example \
VITE_DISPLAY_SERVICE_URL=shlk.example \
VITE_EXTENSION_STORE_URL=https://chrome.google.com/webstore/detail/shlkcc-url-shortener/bjkhbppdemdfngnceocjmeapcfckfkok \
WEB_APP_URL=https://shlk.example \
EXTENSION_ORIGIN=chrome-extension://bjkhbppdemdfngnceocjmeapcfckfkok \
bun run --filter @shlk/web build:extension
```

This creates the unpacked production extension in
`apps/web/dist/extension`. If `zip` is installed, it can be packaged manually:

```sh
mkdir -p release
rm -f release/shlk-extension.zip
(cd apps/web/dist/extension && zip -qr ../../../../release/shlk-extension.zip .)
```

Removing the previous ZIP is important: updating an existing ZIP can retain
files that no longer belong to the extension. The Docker build avoids that
stale-file risk and remains the recommended source of the uploaded artifact.

## Validate the artifact

Check the archive and inspect the generated manifest:

```sh
unzip -t release/shlk-extension.zip
zipinfo -1 release/shlk-extension.zip | grep -x manifest.json
unzip -p release/shlk-extension.zip manifest.json
sha256sum release/shlk-extension.zip
```

The exact line `manifest.json` confirms that the manifest is at the archive
root, rather than inside an extra directory. In the generated manifest, verify:

- `version` is the intended new store version.
- `host_permissions` contains only the intended production API origin and no
  localhost or wildcard origin.
- `externally_connectable.matches` contains only the production website.
- `background.service_worker` is `js/background.js` and every referenced icon
  and popup file exists in the ZIP.
- The archive contains no `.env` files, credentials, test data, or unrelated
  build output.

Load `apps/web/dist/extension` as an unpacked extension in a clean Chrome
profile and exercise the production build against the production service.
At minimum, verify sign-in/session behavior, short-link creation and copying,
snoozed-link alarms and notifications, and website-to-extension messaging.

Before a first submission, also review the source manifest against Chrome's
[required manifest fields](https://developer.chrome.com/docs/extensions/reference/manifest)
and the store listing requirements. Manifest metadata cannot be corrected in
the dashboard after upload; correcting it requires another ZIP with a higher
version.

## Upload to the Chrome Web Store

For an existing listing:

1. Open the item in the
   [developer dashboard](https://chrome.google.com/webstore/devconsole).
2. On **Package**, select **Upload new package** and upload
   `release/shlk-extension.zip`.
3. Review **Store listing**, **Privacy practices**, **Distribution**, and
   **Test instructions**. Keep the listing, permission justifications, user-data
   disclosures, privacy-policy URL, and reviewer instructions consistent with
   the uploaded behavior.
4. Resolve all dashboard validation errors, then select **Submit for review**.
   Use deferred publishing if the release must wait for a coordinated API or
   website deployment.

For a new listing, select **Add new item** in the dashboard and upload the same
ZIP, then complete those tabs before submitting it for review. Chrome's current
step-by-step flow is documented in
[Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish/).

Archive the uploaded ZIP, its SHA-256 digest, the Git commit, and the manifest
version together. Chrome does not permit downgrading to an older version; a
rollback requires a new package whose version is greater than the current store
version.

## Release checklist

- [ ] Project lint, typecheck, and tests pass.
- [ ] Manifest version is greater than the store version.
- [ ] Production URLs and stable extension ID are correct.
- [ ] Requested permissions are minimal and disclosed.
- [ ] Docker produced `release/shlk-extension.zip`.
- [ ] ZIP integrity passes and `manifest.json` is at the archive root.
- [ ] Generated manifest contains no localhost, placeholder, or wildcard origin.
- [ ] Production build was tested as an unpacked extension.
- [ ] Store listing, privacy declarations, and reviewer instructions are current.
- [ ] ZIP digest, Git commit, and version were recorded before submission.
