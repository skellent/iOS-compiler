import mariadb
import sys

class Querys:

    SHOW_TABLES: str = "SHOW TABLES;"

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


    def execute(self, query: str) -> list[dict]:
        self.cursor.execute(query)
        return self.cursor.fetchall()


    def close(self) -> None:
        self.cursor.close()
        self.conn.close()
