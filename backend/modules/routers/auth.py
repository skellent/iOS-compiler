from fastapi import APIRouter, HTTPException

from modules.cursor  import Queries, DuplicateRecordError
from modules.db      import cursor
from modules.guard   import Guard
from modules.token   import Token
from modules.types   import User, UserLogin

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(data: User):
    password_hash: str = Guard.Hash(data.password)
    try:
        cursor.execute(Queries.INSERT_USER, (
            data.name,
            data.phone,
            data.email,
            password_hash)
        )
    except DuplicateRecordError:
        raise HTTPException(status_code=409, detail="Phone or email already registered")
    cursor.commit()

    return {"Skellent": "Success!"}


@router.post("/login")
def login(data: UserLogin):
    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_EMAIL, (data.email,))
    if not rows or not Guard.Verify(data.password, rows[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token: str = Token.Create(rows[0]["id"])
    return {"access_token": token, "token_type": "bearer"}
