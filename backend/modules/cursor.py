import mariadb
import sys

class DuplicateRecordError(Exception):
    pass

class Queries:
    SHOW_TABLES: str = "SHOW TABLES;"
    INSERT_USER: str = "INSERT INTO users (name, phone, email, password_hash) VALUES (%s, %s, %s, %s);"
    SELECT_USER_BY_EMAIL: str = "SELECT id, name, phone, email, password_hash, confirmed FROM users WHERE email = %s;"
    SELECT_USER_BY_ID: str = "SELECT id, name, phone, email FROM users WHERE id = %s;"

    INSERT_CONTACT: str = "INSERT INTO contacts (user_id, name, phone, email) VALUES (%s, %s, %s, %s);"
    SELECT_CONTACTS_BY_USER: str = "SELECT id, name, phone, email, confirmed FROM contacts WHERE user_id = %s;"
    SELECT_CONFIRMED_CONTACTS_BY_USER: str = "SELECT name, phone, email FROM contacts WHERE user_id = %s AND confirmed = TRUE;"
    CONFIRM_CONTACT: str = "UPDATE contacts SET confirmed = TRUE WHERE id = %s;"
    DELETE_CONTACT: str = "DELETE FROM contacts WHERE id = %s AND user_id = %s;"

    CONFIRM_USER: str = "UPDATE users SET confirmed = TRUE WHERE id = %s;"
    PURGE_UNCONFIRMED_USERS: str = "DELETE FROM users WHERE confirmed = FALSE AND created_at < (NOW() - INTERVAL 24 HOUR);"

    INSERT_ALERT: str = "INSERT INTO alerts (user_id, latitude, longitude) VALUES (%s, %s, %s);"

class Cursor:

    def __init__(self, username: str, password: str, host: str, port: int, database: str):
        self._username = username
        self._password = password
        self._host     = host
        self._port     = port
        self._database = database
        self._connect()


    def _connect(self) -> None:
        try:
            self.conn = mariadb.connect(
                user     = self._username,
                password = self._password,
                host     = self._host,
                port     = self._port,
                database = self._database
            )
        except mariadb.Error as e:
            print(f"Error connecting to MariaDB: {e}")
            sys.exit(1)
        self.cursor = self.conn.cursor(dictionary=True)


    def execute(self, query: str, params: tuple = ()) -> list[dict]:
        try:
            self.cursor.execute(query, params)
        except mariadb.IntegrityError as e:
            raise DuplicateRecordError(str(e)) from e
        except mariadb.InterfaceError:
            # The idle connection was closed server-side (e.g. wait_timeout).
            # Reconnect and retry the query once before giving up.
            self._connect()
            self.cursor.execute(query, params)
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
