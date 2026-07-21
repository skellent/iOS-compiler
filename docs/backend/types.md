# `modules/types.py`

## Purpose

This module defines the data models (`pydantic.BaseModel`) that describe the shape data must have coming into the backend through the API. It started with a single model (`User`) and now has six, one for each distinct shape of data an endpoint needs to receive:

```python
class User(BaseModel):
    name:     str
    phone:    str
    email:    str
    password: str

class UserLogin(BaseModel):
    email:    str
    password: str

class UserUpdate(BaseModel):
    name:     str | None = None
    phone:    str | None = None
    email:    str | None = None
    password: str | None = None

class Contact(BaseModel):
    name:  str
    phone: str
    email: str | None = None

class ContactUpdate(BaseModel):
    name:  str | None = None
    phone: str | None = None
    email: str | None = None

class Alert(BaseModel):
    latitude:  float
    longitude: float
```

## Why Pydantic instead of a plain `dict`

FastAPI uses these classes' type annotations for three things at once, with no extra code:

1. **Automatic validation**: if a request to `POST /auth/register` arrives missing one of these fields, or with the wrong type, FastAPI automatically responds with `422 Unprocessable Entity` before the endpoint's code (see `routers.md`) ever runs. This avoids having to write manual validations (`if "name" not in data: ...`) in every endpoint.
2. **Automatic documentation**: FastAPI generates the OpenAPI/Swagger schema (`/docs`) from these classes, so the model doubles as both the API's contract and its interactive documentation.
3. **Typing in the rest of the code**: inside the endpoint, `data: User` allows accessing `data.name`, `data.phone`, etc. with autocomplete and type checking, instead of indexing an unguaranteed dictionary (`data["name"]`).

## Why `User`, `Contact` and `Alert` have every field required

None of the fields on `User`, `Contact` (except `email`, see below) or `Alert` has a default value or is wrapped in `| None`, which in Pydantic means they're required. This is consistent with the schema of the `users`, `contacts` and `alerts` tables (see `sql.md`), where the equivalent columns are `NOT NULL`: it wouldn't make sense for the API to accept an incomplete record if the database is going to reject it anyway, so the validation is moved earlier, to the input layer. `Contact.email` is the only exception, and it's intentional: it reflects that `contacts.email` is the only nullable column in that table (an emergency contact might only be reachable by phone). `Alert` has no equivalent optional field: there's no scenario where it makes sense to log an alert without a location, so both `latitude` and `longitude` are required, just like in the table.

## Why `UserUpdate` and `ContactUpdate` have every field optional

```python
class UserUpdate(BaseModel):
    name:     str | None = None
    phone:    str | None = None
    email:    str | None = None
    password: str | None = None
```

These two models exist for partial edits (`PUT /users/me`, `PUT /contacts/{id}`, see `routers.md`): the client should be able to send only the field it wants to change (for example, `{"name": "New Name"}`) without having to resend every other value it isn't touching. That's why every field is `str | None = None`: if it's not in the request's JSON, Pydantic fills it in with `None` instead of rejecting the request for a "missing field."

The cost of this design is that the endpoint can no longer trust that every field on the model has a useful value — it has to explicitly distinguish "the client didn't send this field" from "the client sent it empty." That's resolved in the router with `data.model_dump(exclude_none=True)`, which drops any field left as `None` from the resulting dictionary, keeping only the ones the client actually sent (see `routers.md` for the detail of how that dictionary is later turned into a dynamic `UPDATE ... SET`).

One consequence of using `None` as the "not sent" value is that there's currently no way to, say, explicitly clear a contact's `email` by deliberately sending `null` (it would be interpreted as "leave it alone," not "clear it"). It's a known and acceptable limitation for the project's current scope: `Contact`'s three fields almost never need to be "cleared," only replaced with another value.

## About `UserLogin` and the `password` field

```python
class UserLogin(BaseModel):
    email:    str
    password: str
```

`User`, `UserLogin` and `UserUpdate` carry the password **in plain text** from the client to the backend; that's necessary, since the backend is the one that has to compute or compare the hash (the client can't be asked to do that and trusted with the result). What matters is that this plain-text value is never persisted or forwarded:

- On `User` and `UserUpdate`, the router (`auth.py`, `users.py`) passes it through `Guard.Hash` (see `guard.md`) immediately, and it's the resulting hash that reaches the database.
- On `UserLogin`, the router (`auth.py`) passes it through `Guard.Verify` alongside the already-stored hash, and the result of that comparison (true or false) is the only thing that keeps circulating — the password itself is discarded as soon as it's used.

`UserLogin` doesn't reuse `User` even though they share two fields (`email`, `password`) because they're conceptually different requests: one creates a new resource and needs all of a user's data, the other only verifies an identity that already exists. Forcing the client to send `name` and `phone` just to log in would have been confusing and wouldn't have added anything to the login flow.

## Relationship with the rest of the backend

Each model is used as the parameter type for exactly one endpoint in `modules/routers/` (see `routers.md`):

| Model           | Endpoint             |
|-----------------|-----------------------|
| `User`          | `POST /auth/register` |
| `UserLogin`     | `POST /auth/login`    |
| `UserUpdate`    | `PUT /users/me`       |
| `Contact`       | `POST /contacts`      |
| `ContactUpdate` | `PUT /contacts/{id}`  |
| `Alert`         | `POST /alerts`        |

`GET /contacts/confirm/{token}` (see `routers.md`, `mail.md`) is the only exception to "one endpoint, one model": it receives no body, the `token` travels in the URL, so it didn't need any new model here.

As the API grows (integration with a third-party API like Twilio to notify by SMS), this file is expected to keep accumulating one model per shape of data going in or out of the API, following the same pattern.
