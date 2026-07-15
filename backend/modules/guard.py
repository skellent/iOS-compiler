from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Guard:
    @staticmethod
    def Crear(contraseña: str) -> str:
        return pwd_context.hash(contraseña)

    @staticmethod
    def Validar(contraseña: str, hash_guardado: str) -> bool:
        return pwd_context.verify(contraseña, hash_guardado)



