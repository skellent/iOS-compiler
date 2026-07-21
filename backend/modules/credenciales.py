import os
from dotenv import load_dotenv


def obtener_credenciales() -> dict:
    load_dotenv()

    return {
        "database": {
            'user':     os.getenv("USERNAME"),
            'password': os.getenv("PASSWORD"),
            'host':     os.getenv("HOST"),
            'port':     int(os.getenv("PORT")),
            'database': os.getenv("DATABASE")
        },
        "api": { # Proximanente, la lectura de las credenciales correspondientes de la API que realizan las alertas
            'Auth': None,
            'Key':  None,
        },
        "jwt": {
            'secret_key': os.getenv("JWT_SECRET_KEY"),
        },
        "correo": {
            'usuario':  os.getenv("SMTP_USER"),
            'password': os.getenv("SMTP_PASSWORD"),
            'host':     os.getenv("SMTP_HOST", "smtp.gmail.com"),
            'port':     int(os.getenv("SMTP_PORT", 587)),
        },
        "api_base_url": os.getenv("API_BASE_URL", "http://127.0.0.1:8000"),
    }
