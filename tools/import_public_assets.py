#!/usr/bin/env python3
"""Recover published game binaries, accepting only exact Git blob matches.

Source of truth is migration/binary-manifest.json. Restricted Sonniss
studio recordings are intentionally absent from this manifest.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import json
from pathlib import Path, PurePosixPath
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "migration" / "binary-manifest.json"
REPORT = ROOT / "migration" / "binary-import-report.json"


def git_blob_sha(data: bytes) -> str:
    header = b"blob " + str(len(data)).encode("ascii") + b"\0"
    return hashlib.sha1(header + data).hexdigest()


def verified_path(name: str) -> Path:
    path = PurePosixPath(name)
    if path.is_absolute() or not path.parts or any(p in (".", "..") for p in path.parts):
        raise ValueError(f"unsafe path: {name!r}")
    return ROOT.joinpath(*path.parts)


def import_one(entry: dict, base_url: str) -> dict:
    name = entry["path"]
    expected_sha = entry["sha"]
    expected_size = entry["size"]
    destination = verified_path(name)

    if destination.exists():
        data = destination.read_bytes()
        if len(data) == expected_size and git_blob_sha(data) == expected_sha:
            return {"path": name, "status": "already verified"}
        return {"path": name, "status": "failed", "reason": "existing file differs; refusing to overwrite"}

    url = base_url.rstrip("/") + "/" + quote(name, safe="/")
    failure = "unavailable"
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "Survivor-Open-Asset-Verification/1.0"})
            with urlopen(request, timeout=25) as response:
                data = response.read()
            if len(data) != expected_size:
                return {"path": name, "status": "failed", "reason": f"size mismatch: {len(data)} != {expected_size}"}
            actual_sha = git_blob_sha(data)
            if actual_sha != expected_sha:
                return {"path": name, "status": "failed", "reason": f"Git SHA mismatch: {actual_sha} != {expected_sha}"}
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            return {"path": name, "status": "downloaded"}
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            failure = f"{type(exc).__name__}: {exc}"
            if isinstance(exc, HTTPError) and exc.code in (401, 403, 404, 410):
                break
            if attempt < 2:
                time.sleep(attempt + 1)
    return {"path": name, "status": "failed", "reason": failure}


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = manifest["files"]
    forbidden = "audio-lab/assets/sfx/studio/"
    if any(e["path"].startswith(forbidden) for e in entries):
        raise SystemExit("Refusing to import restricted studio recordings")
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(import_one, entry, manifest["baseUrl"]) for entry in entries]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda x: x["path"])
    failures = [r for r in results if r["status"] == "failed"]
    report = {
        "sourceCommit": manifest["sourceCommit"],
        "attempted": len(results),
        "downloaded": sum(r["status"] == "downloaded" for r in results),
        "alreadyVerified": sum(r["status"] == "already verified" for r in results),
        "failed": len(failures),
        "failures": failures,
        "restrictedStudioOggExcluded": 26,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Verified: {report['downloaded'] + report['alreadyVerified']}/{report['attempted']}")
    if failures:
        print("Unavailable or changed:", len(failures))
        for item in failures[:25]:
            print(item["path"], item["reason"])


if __name__ == "__main__":
    main()
