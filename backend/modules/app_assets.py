import hashlib
import threading
from pathlib import Path

APP_WWW_DIR: Path = Path(__file__).resolve().parent.parent.parent / "app" / "www"

_lock = threading.Lock()
_cached_signature: tuple | None = None
_cached_manifest: dict = {"version": ""}


def _signature() -> tuple:
    """Cheap fingerprint of the tree: (file count, newest mtime, total size)."""
    count: int = 0
    newest: float = 0.0
    total: int = 0
    for path in APP_WWW_DIR.rglob("*"):
        if path.is_file():
            stat = path.stat()
            count += 1
            total += stat.st_size
            if stat.st_mtime > newest:
                newest = stat.st_mtime
    return (count, newest, total)


def _hash_tree() -> str:
    hasher = hashlib.sha256()
    for path in sorted(APP_WWW_DIR.rglob("*")):
        if path.is_file():
            hasher.update(str(path.relative_to(APP_WWW_DIR)).encode())
            hasher.update(path.read_bytes())
    return hasher.hexdigest()


def get_manifest() -> dict:
    """
    Content hash of app/www, recomputed only when the tree actually changes.

    Every app launch and every resume hits this endpoint, so the previous version —
    which re-read and re-hashed every file (including the bundle and all images) on
    each request — was doing real work per device, per foreground. Stat'ing the tree
    is enough to notice a deploy; the full hash only runs when it changed.
    """
    global _cached_signature, _cached_manifest

    signature: tuple = _signature()
    with _lock:
        if signature != _cached_signature:
            _cached_manifest = {"version": _hash_tree()}
            _cached_signature = signature
        return _cached_manifest
