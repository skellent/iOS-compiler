from pydantic import BaseModel

class Usuario(BaseModel):
    nombre:     str
    telefono:   str
    correo:     str
    contraseña: str
