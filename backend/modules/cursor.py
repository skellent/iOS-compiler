import mariadb
import sys

from mariadb.constants import CLIENT

from modules.logs import get_logger

_logger = get_logger(__name__)

class DuplicateRecordError(Exception):
    pass

class Queries:
    SHOW_TABLES: str = "SHOW TABLES;"
    INSERT_USER: str = "INSERT INTO users (name, phone, email, password_hash) VALUES (%s, %s, %s, %s);"
    SELECT_USER_BY_EMAIL: str = "SELECT id, name, phone, email, password_hash, confirmed FROM users WHERE email = %s;"
    SELECT_USER_BY_ID: str = "SELECT id, name, phone, email FROM users WHERE id = %s;"

    INSERT_CONTACT: str = "INSERT INTO contacts (user_id, name, phone, email) VALUES (%s, %s, %s, %s);"
    SELECT_CONTACTS_BY_USER: str = "SELECT id, name, phone, email, confirmed, (telegram_chat_id IS NOT NULL) AS telegram_linked FROM contacts WHERE user_id = %s;"
    # A contact is notified over email when `confirmed`, over Telegram when
    # `telegram_chat_id` is set — the two channels are independent, not
    # sequential, so either one alone is enough to appear here.
    SELECT_CONFIRMED_CONTACTS_BY_USER: str = "SELECT id, name, phone, email, telegram_chat_id FROM contacts WHERE user_id = %s AND (confirmed = TRUE OR telegram_chat_id IS NOT NULL);"
    CONFIRM_CONTACT: str = "UPDATE contacts SET confirmed = TRUE WHERE id = %s;"
    DELETE_CONTACT: str = "DELETE FROM contacts WHERE id = %s AND user_id = %s;"

    SET_CONTACT_TELEGRAM_LINK_TOKEN: str = "UPDATE contacts SET telegram_link_token = %s, telegram_link_expires_at = %s WHERE id = %s AND user_id = %s;"
    SELECT_CONTACT_BY_TELEGRAM_TOKEN: str = (
        "SELECT contacts.id, contacts.name AS contact_name, users.name AS user_name "
        "FROM contacts JOIN users ON users.id = contacts.user_id "
        "WHERE contacts.telegram_link_token = %s AND contacts.telegram_link_expires_at > NOW();"
    )
    CONFIRM_CONTACT_TELEGRAM: str = "UPDATE contacts SET telegram_chat_id = %s, telegram_link_token = NULL, telegram_link_expires_at = NULL WHERE id = %s;"
    CLEAR_CONTACT_TELEGRAM: str = "UPDATE contacts SET telegram_chat_id = NULL, telegram_link_token = NULL, telegram_link_expires_at = NULL WHERE id = %s AND user_id = %s;"

    CONFIRM_USER: str = "UPDATE users SET confirmed = TRUE WHERE id = %s;"
    PURGE_UNCONFIRMED_USERS: str = "DELETE FROM users WHERE confirmed = FALSE AND created_at < (NOW() - INTERVAL 24 HOUR);"

    INSERT_ALERT: str = "INSERT INTO alerts (user_id, latitude, longitude) VALUES (%s, %s, %s);"
    SELECT_ALERTS_BY_USER: str = "SELECT id, created_at, latitude, longitude FROM alerts WHERE user_id = %s ORDER BY created_at DESC;"

    INSERT_ALERT_NOTIFICATION: str = "INSERT INTO alert_notifications (alert_id, contact_id, channel) VALUES (%s, %s, %s);"
    SELECT_ALERT_NOTIFICATIONS_BY_ALERT: str = (
        "SELECT alert_notifications.channel, alert_notifications.viewed_at, contacts.name AS contact_name "
        "FROM alert_notifications JOIN contacts ON contacts.id = alert_notifications.contact_id "
        "WHERE alert_notifications.alert_id = %s ORDER BY contacts.name;"
    )
    SELECT_ALERT_NOTIFICATION_BY_ID: str = (
        "SELECT alert_notifications.id, alert_notifications.viewed_at, alerts.latitude, alerts.longitude "
        "FROM alert_notifications JOIN alerts ON alerts.id = alert_notifications.alert_id "
        "WHERE alert_notifications.id = %s;"
    )
    MARK_ALERT_NOTIFICATION_VIEWED: str = "UPDATE alert_notifications SET viewed_at = NOW() WHERE id = %s AND viewed_at IS NULL;"

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
                user        = self._username,
                password    = self._password,
                host        = self._host,
                port        = self._port,
                database    = self._database,
                # Without this, UPDATEs that match a row but don't change its
                # value report rowcount=0, indistinguishable from "no such
                # row" — every existence/ownership check in this codebase
                # relies on rowcount actually meaning "rows matched".
                client_flag = CLIENT.FOUND_ROWS,
                # Every write already calls commit() explicitly; this just
                # guarantees a stray write on a code path that forgets to
                # (or a plain SELECT, which still opens a transaction) can't
                # leave a row locked indefinitely on this shared connection.
                autocommit  = True,
            )
        except mariadb.Error as e:
            _logger.critical(f"Error connecting to MariaDB: {e}")
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
            _logger.warning("MariaDB connection was stale, reconnecting")
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
