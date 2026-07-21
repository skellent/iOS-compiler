from modules.cursor      import Cursor
from modules.credentials import get_credentials


credentials: dict = get_credentials()

cursor: Cursor = Cursor(
    credentials['database']['user'],
    credentials['database']['password'],
    credentials['database']['host'],
    credentials['database']['port'],
    credentials['database']['database'],
)
