from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Guard:
    @staticmethod
    def Hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def Verify(password: str, stored_hash: str) -> bool:
        return pwd_context.verify(password, stored_hash)


