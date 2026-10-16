#!/usr/bin/env python3
"""Package existing production builds for Chrome Web Store and Mozilla AMO."""

import argparse
import json
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
BUILDS = {
    "chrome": ("extension", "shlk-extension.zip"),
    "firefox": ("extension-firefox", "shlk-extension-firefox.zip"),
}


def build_files(browser):
    directory = ROOT / "apps/web/dist" / BUILDS[browser][0]
    manifest_path = directory / "manifest.json"
    if not manifest_path.is_file():
        raise ValueError(f"Missing {manifest_path}; run make build-{browser} first")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for field in ("name", "version", "description", "icons"):
        if not manifest.get(field):
            raise ValueError(f"{browser}: manifest is missing {field}")

    background = manifest.get("background", {})
    references = list(manifest["icons"].values())
    action = manifest.get("action", {})
    references.append(action.get("default_popup", "index.html"))
    icon = action.get("default_icon", {})
    references.extend([icon] if isinstance(icon, str) else icon.values())
    if browser == "chrome":
        if not background.get("service_worker"):
            raise ValueError("chrome: missing background service worker")
        references.append(background["service_worker"])
        website_matches = manifest.get("externally_connectable", {}).get("matches", [])
    else:
        gecko = manifest.get("browser_specific_settings", {}).get("gecko", {})
        if not gecko.get("id") or not background.get("scripts"):
            raise ValueError("firefox: missing add-on ID or background scripts")
        references.extend(background["scripts"])
        website_matches = []
        for script in manifest.get("content_scripts", []):
            website_matches.extend(script.get("matches", []))
            references.extend(script.get("js", []))
            references.extend(script.get("css", []))

    hosts = manifest.get("host_permissions", [])
    if not hosts or not website_matches:
        raise ValueError(f"{browser}: missing API or website permissions")
    for pattern in hosts + website_matches:
        url = urlsplit(pattern)
        if (url.scheme != "https" or not url.hostname or "*" in url.hostname
                or url.hostname in ("localhost", "127.0.0.1", "::1")):
            raise ValueError(f"{browser}: {pattern!r} is not a production HTTPS origin; rebuild with production URLs")

    files = []
    for path in sorted(directory.rglob("*")):
        relative = path.relative_to(directory)
        if path.is_symlink():
            raise ValueError(f"Refusing to package symlink: {path}")
        if path.is_file() and not any(part.startswith(".") for part in relative.parts):
            files.append((path, relative.as_posix()))
    names = {name for _, name in files}
    for reference in references:
        if reference.lstrip("/") not in names:
            raise ValueError(f"{browser}: missing manifest resource {reference}")
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("browser", nargs="?", choices=("all", *BUILDS), default="all")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "release")
    args = parser.parse_args()
    browsers = list(BUILDS) if args.browser == "all" else [args.browser]
    # Validate every selected build before replacing any previous release ZIP.
    builds = [(browser, build_files(browser)) for browser in browsers]
    output = args.output_dir.resolve()
    if output.is_relative_to(ROOT / "apps/web/dist"):
        raise ValueError("Output directory must be outside apps/web/dist")
    output.mkdir(parents=True, exist_ok=True)
    for browser, files in builds:
        destination = output / BUILDS[browser][1]
        with tempfile.TemporaryDirectory(dir=output) as temporary:
            archive_path = Path(temporary) / destination.name
            with ZipFile(archive_path, "w", ZIP_DEFLATED, compresslevel=9) as archive:
                for path, name in files:
                    archive.write(path, name)
            archive_path.replace(destination)
        print(f"{browser}: {destination}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        sys.exit(f"Packaging failed: {error}")
