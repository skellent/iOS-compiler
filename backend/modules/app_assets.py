import hashlib
from pathlib import Path

APP_WWW_DIR: Path = Path(__file__).resolve().parent.parent.parent / "app" / "www"


def get_manifest() -> dict:
    hasher = hashlib.sha256()
    for path in sorted(APP_WWW_DIR.rglob("*")):
        if path.is_file():
            hasher.update(str(path.relative_to(APP_WWW_DIR)).encode())
            hasher.update(path.read_bytes())
    return {"version": hasher.hexdigest()}
