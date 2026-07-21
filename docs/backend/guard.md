# `modules/guard.py`

## Purpose

This module isolates everything related to safely handling passwords behind a `Guard` class with two static methods:

- `Guard.Hash(password)`: turns a plain-text password into a secure hash for storage.
- `Guard.Verify(password, stored_hash)`: checks whether a plain-text password matches an already-stored hash.

## Why the password is never stored in plain text

The `users` table (see `sql.md`) has a `password_hash` column, not `password`. This is intentional: if the database were ever leaked, storing passwords in plain text would directly expose the credentials of every user of a system meant for personal emergencies, where confidentiality is especially sensitive. Instead, only a hash is stored, from which the original password can't, in theory, be recovered.

## Why bcrypt instead of a generic hash (SHA-256, MD5, etc.)

`Guard` uses `passlib.context.CryptContext` configured with `schemes=["bcrypt"]`. Choosing bcrypt (instead of a generic cryptographic hash) reflects that bcrypt is deliberately designed to be **slow and expensive to compute**, with an adjustable cost factor. That's exactly what's needed for passwords: an attacker who obtains the database and wants to brute-force passwords is limited by that computational cost, something a fast hash like SHA-256 doesn't offer (it was designed for speed, not to resist this kind of attack).

The `deprecated="auto"` parameter tells `passlib` that, if a newer hashing scheme is ever added to the `schemes` list, hashes generated with the previous scheme should keep being accepted as valid but get flagged as "to migrate." This allows the hashing algorithm to be hardened in the future without invalidating already-stored passwords all at once.

## Why `bcrypt<4.1` in `pyproject.toml`

In `backend/pyproject.toml` the dependency is pinned as `"bcrypt<4.1"`. This isn't arbitrary: `bcrypt` versions 4.1 and later changed internal package details that break the way `passlib` (version 1.7.4, used here) detects the installed bcrypt backend's version, causing errors or warnings when hashing passwords. Pinning the version ceiling avoids that known compatibility issue between the two libraries.

## Static methods, not instances

`Hash` and `Verify` are `@staticmethod`: `Guard` doesn't need to keep its own state between calls (the `CryptContext` lives at module level and is shared), so there's no reason to instantiate a `Guard()` object to use them. They're called directly as `Guard.Hash(...)`.

## Relationship with the rest of the backend

`Guard` is used in two different spots in `modules/routers/` (see `routers.md`):

- `auth.py` calls `Guard.Hash(data.password)` right before inserting a new user (`POST /auth/register`) and also inside `PUT /users/me` when the client decides to change their password (`users.py`), so the value that reaches the database is always the hash, never the original password.
- `auth.py` calls `Guard.Verify(data.password, row["password_hash"])` inside `POST /auth/login`: it fetches the stored hash with `Queries.SELECT_USER_BY_EMAIL` (see `cursor.md`) and compares the plain-text password the client sent against that hash. If it matches, a JWT is issued with `Token.Create` (see `token.md`); if not, the endpoint responds `401 Unauthorized` without giving further detail about whether the email exists or the password was wrong, so as not to help someone enumerate which emails are registered.

With this, both of `Guard`'s methods, present since the beginning of the project, are now in active use.
