import mariadb
import sys

class RegistroDuplicadoError(Exception):
    pass

class Querys:
    SHOW_TABLES: str = "SHOW TABLES;"
    INSERT_USUARIO: str = "INSERT INTO usuarios (nombre, telefono, correo, contraseña_hash) VALUES (%s, %s, %s, %s);"
    SELECT_USUARIO_POR_CORREO: str = "SELECT id, nombre, telefono, correo, contraseña_hash FROM usuarios WHERE correo = %s;"
    SELECT_USUARIO_POR_ID: str = "SELECT id, nombre, telefono, correo FROM usuarios WHERE id = %s;"

    INSERT_CONTACTO: str = "INSERT INTO contactos (id_usuario, nombre, telefono, correo) VALUES (%s, %s, %s, %s);"
    SELECT_CONTACTOS_POR_USUARIO: str = "SELECT id, nombre, telefono, correo, confirmado FROM contactos WHERE id_usuario = %s;"
    SELECT_CONTACTOS_CONFIRMADOS_POR_USUARIO: str = "SELECT nombre, telefono, correo FROM contactos WHERE id_usuario = %s AND confirmado = TRUE;"
    CONFIRMAR_CONTACTO: str = "UPDATE contactos SET confirmado = TRUE WHERE id = %s;"

    INSERT_ALERTA: str = "INSERT INTO alertas (id_usuario, latitud, longitud) VALUES (%s, %s, %s);"

class Cursor:

    def __init__(self, username: str, password: str, host: str, port: int, database: str):
        try:
            self.conn = mariadb.connect(
                user     = username,
                password = password,
                host     = host,
                port     = port,
                database = database
            )
        except mariadb.Error as e:
            print(f"Error connecting to MariaDB: {e}")
            sys.exit(1)
        self.cursor = self.conn.cursor(dictionary=True)


    def execute(self, query: str, params: tuple = ()) -> list[dict]:
        try:
            self.cursor.execute(query, params)
        except mariadb.IntegrityError as e:
            raise RegistroDuplicadoError(str(e)) from e
        try:
            return self.cursor.fetchall()
        except mariadb.ProgrammingError:
            return []


    @property
    def rowcount(self) -> int:
        return self.cursor.rowcount


    @property
    def lastrowid(self) -> int:
        return self.cursor.lastrowid


    def commit(self) -> None:
        self.conn.commit()


    def close(self) -> None:
        self.cursor.close()
        self.conn.close()
