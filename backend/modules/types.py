from pydantic import BaseModel

class Usuario(BaseModel):
    nombre:     str
    telefono:   str
    correo:     str
    contraseña: str

class UsuarioLogin(BaseModel):
    correo:     str
    contraseña: str

class UsuarioUpdate(BaseModel):
    nombre:     str | None = None
    telefono:   str | None = None
    correo:     str | None = None
    contraseña: str | None = None

class Contacto(BaseModel):
    nombre:   str
    telefono: str
    correo:   str | None = None

class ContactoUpdate(BaseModel):
    nombre:   str | None = None
    telefono: str | None = None
    correo:   str | None = None

class Alerta(BaseModel):
    latitud:  float
    longitud: float
