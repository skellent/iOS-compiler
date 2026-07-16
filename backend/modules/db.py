from modules.cursor       import Cursor
from modules.credenciales import obtener_credenciales


credenciales: dict = obtener_credenciales()

cursor: Cursor = Cursor(
    credenciales['database']['user'],
    credenciales['database']['password'],
    credenciales['database']['host'],
    credenciales['database']['port'],
    credenciales['database']['database'],
)
