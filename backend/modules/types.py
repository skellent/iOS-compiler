from pydantic import BaseModel

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
