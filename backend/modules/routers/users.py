from fastapi import APIRouter, Depends, HTTPException

from modules.cursor       import Queries, DuplicateRecordError
from modules.db           import cursor
from modules.dependencies import current_user
from modules.guard        import Guard
from modules.logs         import get_logger
from modules.types        import UserPublic, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])
_logger = get_logger(__name__)

_COLUMN_BY_FIELD: dict[str, str] = {
    "name":     "name",
    "phone":    "phone",
    "email":    "email",
    "password": "password_hash",
}


@router.get("/me", response_model=UserPublic)
def get_current_user(user_id: int = Depends(current_user)):
    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    return rows[0]


@router.put("/me", response_model=UserPublic)
def update_current_user(data: UserUpdate, user_id: int = Depends(current_user)):
    fields: dict = data.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields were provided to update")

    if "password" in fields:
        fields["password"] = Guard.Hash(fields["password"])

    set_clause: str = ", ".join(f"{_COLUMN_BY_FIELD[field]} = %s" for field in fields)
    values: tuple = tuple(str(value) for value in fields.values()) + (user_id,)

    try:
        cursor.execute(f"UPDATE users SET {set_clause} WHERE id = %s;", values)
    except DuplicateRecordError:
        raise HTTPException(status_code=409, detail="Phone or email already registered")
    cursor.commit()
    _logger.info(f"User {user_id} updated fields: {', '.join(fields.keys())}")

    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    return rows[0]
