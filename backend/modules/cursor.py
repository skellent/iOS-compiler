import mariadb
import sys

class Querys:
    SHOW_TABLES: str = "SHOW TABLES;"
    INSERT_USUARIO: str = "INSERT INTO usuarios (nombre, telefono, correo, contraseña_hash) VALUES (%s, %s, %s, %s);"

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
        self.cursor.execute(query, params)
        try:
            return self.cursor.fetchall()
        except mariadb.ProgrammingError:
            return []


    def commit(self) -> None:
        self.conn.commit()


    def close(self) -> None:
        self.cursor.close()
        self.conn.close()
