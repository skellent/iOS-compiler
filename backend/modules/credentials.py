import os
from dotenv import load_dotenv


def get_credentials() -> dict:
    load_dotenv()

    return {
        "database": {
            'user':     os.getenv("USERNAME"),
            'password': os.getenv("PASSWORD"),
            'host':     os.getenv("HOST"),
            'port':     int(os.getenv("PORT")),
            'database': os.getenv("DATABASE")
        },
        "api": { # Coming soon: reading the credentials for the third-party API that dispatches alerts
            'Auth': None,
            'Key':  None,
        },
        "jwt": {
            'secret_key': os.getenv("JWT_SECRET_KEY"),
        },
        "email": {
            'user':     os.getenv("SMTP_USER"),
            'password': os.getenv("SMTP_PASSWORD"),
            'host':     os.getenv("SMTP_HOST", "smtp.gmail.com"),
            'port':     int(os.getenv("SMTP_PORT", 587)),
        },
        "api_base_url": os.getenv("API_BASE_URL", "http://127.0.0.1:8000"),
        "app_mode": os.getenv("APP_MODE", "Debug"),
        "app_deep_link": os.getenv("APP_DEEP_LINK", "panicswitch://confirmed"),
    }
