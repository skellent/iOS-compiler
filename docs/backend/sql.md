# `queries/` — SQL scripts

This directory holds the SQL needed to set up and seed PanicSwitch's database. It isn't Python code that runs automatically: these are scripts an administrator runs manually against MariaDB, in the order described in the main README (section "1. Configure MariaDB").

## `creation.sql` — initial provisioning

```sql
CREATE DATABASE <Database Name> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER '<Username>'@'localhost' IDENTIFIED BY '<A Password>';
GRANT ALL PRIVILEGES ON panic_dev.* TO '<Username>'@'localhost';
FLUSH PRIVILEGES;
```

This script runs exactly once, as MariaDB's `root` user, and settles two design decisions:

- **`utf8mb4` / `utf8mb4_unicode_ci`**: chosen explicitly over the `latin1` or (3-byte) `utf8` that MariaDB might default to, because the application's data (names, emails) may include accented characters, the letter "ñ," and, potentially, emojis from a mobile client. `utf8mb4` is the only one of the three that correctly represents the full Unicode character set.
- **A dedicated database user, not `root`**: a dedicated user is created with privileges scoped to the project's database (`panic_dev`), instead of the backend connecting with administrator credentials. This is a direct application of the principle of least privilege: if the backend's credentials (stored in `.env`) leak, the damage stays contained to that single database.

The `<...>` markers are placeholders to be filled in by whoever deploys the project; the real values should never be committed to this file (hence why `.env` is in `.gitignore`).

## `tables.sql` — data schema

Defines the three tables that model the application's domain.

### `users`

```sql
CREATE TABLE users (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    phone         VARCHAR(20)  NOT NULL UNIQUE,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

This is the central table: each row is a person registered in the app. A few design decisions worth pointing out:

- `phone` and `email` are `UNIQUE`: each phone number and each email can only belong to one account. This prevents duplicate registrations and is consistent with the fact that, in a panic-button app, the phone number is probably the identifier other systems (SMS, calls) will use to locate a user.
- `password_hash VARCHAR(255)`: the generous size isn't accidental — bcrypt hashes (see `guard.md`) have a known, fixed-length format, but leaving margin avoids having to migrate the schema if the hashing algorithm ever changes (for example, to Argon2, whose hashes are longer).
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`: automatically records when the account was created, without the application having to send it explicitly on every `INSERT` (in fact, `Queries.INSERT_USER` in `cursor.py` doesn't include this column).

### `contacts`

```sql
CREATE TABLE contacts (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    name       VARCHAR(100) NOT NULL,
    phone      VARCHAR(20)  NOT NULL,
    email      VARCHAR(120),
    confirmed  BOOLEAN      NOT NULL DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

Represents each user's **emergency contacts**: the people who must be notified when an alert is triggered. It's a one-to-many relationship with `users` through the `user_id` foreign key.

- `email` is nullable, unlike `users.email`: an emergency contact might only be reachable by phone (via SMS, for example), without that preventing them from being registered.
- `confirmed BOOLEAN DEFAULT FALSE`: exists because adding someone as an emergency contact shouldn't rely solely on the word of the user registering them — that person should probably confirm (for example, by replying to a message or verification email) that they agree to receive alerts on their behalf. The `FALSE` default reflects that this consent isn't assumed, it's granted explicitly in a later step. That step is already implemented (see `mail.md`, `token.md` and `routers.md`): `POST /contacts` sends an email with a confirmation link when the contact has an `email`, and `GET /contacts/confirm/{token}` is what actually sets this column to `TRUE`. A contact created without an `email` (remember it's the only optional field on `Contact`, see `types.md`) stays at `FALSE` indefinitely, since there's currently no other channel (SMS, for example) to confirm it.

### `alerts`

```sql
CREATE TABLE alerts (
    id         INT      AUTO_INCREMENT PRIMARY KEY,
    user_id    INT      NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    latitude   DOUBLE   NOT NULL,
    longitude  DOUBLE   NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

This is the historical record of every time a user hits the panic button: which user, when (`created_at`, with the same `DEFAULT CURRENT_TIMESTAMP` pattern as `users.created_at`) and where (`latitude`/`longitude` as `DOUBLE`, the standard precision for GPS coordinates). In a sense, this table is the whole reason the project exists: the other two tables exist so the app can respond correctly whenever a row gets inserted here.

Since the contact CRUD was added (see `routers.md`), this table is now actively read and written to: `POST /contacts`, `GET /contacts`, `GET /contacts/confirm/{token}` and `PUT /contacts/{id}`. Unlike before, `confirmed` is no longer a field no endpoint touches: `GET /contacts/confirm/{token}` sets it to `TRUE` when the contact clicks the link they received by email (see `mail.md`).

`alerts` also isn't just a schema prepared in advance anymore: `POST /alerts` (see `routers.md`) inserts a row here every time the panic button is triggered, and uses that exact row (`user_id`, `latitude`, `longitude`) to build the notification that reaches that user's **confirmed** emergency contacts (see `mail.md`). The link between `confirmed` and this table is, at bottom, that column's whole reason for existing: a contact who never agreed to receive alerts shouldn't start receiving them right at the most critical moment, so `POST /alerts` filters by `confirmed = TRUE` before notifying anyone (`Queries.SELECT_CONFIRMED_CONTACTS_BY_USER`, see `cursor.md`). Notifying by SMS (in addition to or instead of email) is still pending the Twilio integration.

## `insertions.sql` — sample data

```sql
INSERT INTO users (...) VALUES ('First Last', '+1234567891233', 'name@example.com', '$2b$12$...hashdeejemplo');
INSERT INTO contacts (...) VALUES (1, 'Jane Doe', ...), (1, 'John Doe', ...);
INSERT INTO alerts (user_id, latitude, longitude) VALUES (1, 10.4880600, -66.8791500);
```

Not a script the application runs: it's reference material, mentioned in the README, so whoever sets up the environment for the first time can see a concrete example of the format each table expects (including what a real bcrypt hash looks like) and, optionally, seed test data into a local development environment. The password hash shown there is a sample value, and doesn't correspond to any usable real password.
