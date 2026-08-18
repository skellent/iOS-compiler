import threading
from contextlib import contextmanager

import mariadb

from mariadb.constants import CLIENT

from modules.logs import get_logger

_logger = get_logger(__name__)

class DuplicateRecordError(Exception):
    pass

class Queries:
    SHOW_TABLES: str = "SHOW TABLES;"
    PING: str = "SELECT 1 AS ok;"
    INSERT_USER: str = "INSERT INTO users (name, phone, email, password_hash) VALUES (%s, %s, %s, %s);"
    SELECT_USER_BY_EMAIL: str = "SELECT id, name, phone, email, password_hash, confirmed FROM users WHERE email = %s;"
    SELECT_USER_BY_ID: str = "SELECT id, name, phone, email, confirmed FROM users WHERE id = %s;"
    SELECT_USER_HASH_BY_ID: str = "SELECT password_hash FROM users WHERE id = %s;"

    INSERT_CONTACT: str = "INSERT INTO contacts (user_id, name, phone, email) VALUES (%s, %s, %s, %s);"
    COUNT_CONTACTS_BY_USER: str = "SELECT COUNT(*) AS total FROM contacts WHERE user_id = %s;"
    # Taken inside a transaction before counting contacts, so two concurrent creates
    # for the same user run one after the other instead of both seeing "3 contacts".
    # Locks that user's row only — other users are unaffected.
    LOCK_USER: str = "SELECT id FROM users WHERE id = %s FOR UPDATE;"
    SELECT_CONTACTS_BY_USER: str = "SELECT id, name, phone, email, confirmed, (telegram_chat_id IS NOT NULL) AS telegram_linked FROM contacts WHERE user_id = %s;"
    SELECT_CONTACT_BY_ID: str = "SELECT id, name, phone, email, confirmed, (telegram_chat_id IS NOT NULL) AS telegram_linked FROM contacts WHERE id = %s AND user_id = %s;"
    SELECT_CONFIRMED_CONTACTS_BY_USER: str = "SELECT id, name, phone, email, confirmed, telegram_chat_id FROM contacts WHERE user_id = %s AND (confirmed = TRUE OR telegram_chat_id IS NOT NULL);"
    CONFIRM_CONTACT: str = "UPDATE contacts SET confirmed = TRUE WHERE id = %s;"
    SELECT_CONTACT_ID_FOR_USER: str = "SELECT id FROM contacts WHERE id = %s AND user_id = %s;"
    # alert_notifications.contact_id is a FK with no ON DELETE CASCADE, so a contact
    # that was ever notified can't be deleted until its notification rows are gone.
    DELETE_ALERT_NOTIFICATIONS_BY_CONTACT: str = "DELETE FROM alert_notifications WHERE contact_id = %s;"
    DELETE_CONTACT: str = "DELETE FROM contacts WHERE id = %s AND user_id = %s;"

    SET_CONTACT_TELEGRAM_LINK_TOKEN: str = (
        "UPDATE contacts SET telegram_link_token = %s, "
        "telegram_link_expires_at = (NOW() + INTERVAL %s HOUR) WHERE id = %s AND user_id = %s;"
    )
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
    # One query for every notification belonging to one user's alerts, so listing
    # alerts costs 2 queries instead of 1-per-alert.
    SELECT_ALERT_NOTIFICATIONS_BY_USER: str = (
        "SELECT alert_notifications.alert_id, alert_notifications.channel, alert_notifications.viewed_at, "
        "contacts.name AS contact_name "
        "FROM alert_notifications "
        "JOIN contacts ON contacts.id = alert_notifications.contact_id "
        "JOIN alerts ON alerts.id = alert_notifications.alert_id "
        "WHERE alerts.user_id = %s ORDER BY contacts.name;"
    )
    SELECT_ALERT_NOTIFICATION_BY_ID: str = (
        "SELECT alert_notifications.id, alert_notifications.viewed_at, alerts.latitude, alerts.longitude "
        "FROM alert_notifications JOIN alerts ON alerts.id = alert_notifications.alert_id "
        "WHERE alert_notifications.id = %s;"
    )
    MARK_ALERT_NOTIFICATION_VIEWED: str = "UPDATE alert_notifications SET viewed_at = NOW() WHERE id = %s AND viewed_at IS NULL;"


class _Connection:
    """One MariaDB connection plus its cursor, owned by exactly one thread."""

    __slots__ = ("conn", "cursor")

    def __init__(self, conn, cursor) -> None:
        self.conn = conn
        self.cursor = cursor


class Cursor:
    """
    Thread-confined database access.

    FastAPI runs `def` routes in a threadpool, so a single shared connection meant
    several requests interleaving `execute()` / `rowcount` / `lastrowid` on the same
    cursor object — one request could read another's insert id. Each thread now gets
    its own connection and cursor, created on first use, so those reads always
    describe the statement this thread just ran.
    """

    def __init__(self, username: str, password: str, host: str, port: int, database: str):
        self._username = username
        self._password = password
        self._host     = host
        self._port     = port
        self._database = database
        self._local    = threading.local()


    def _open(self) -> _Connection:
        conn = mariadb.connect(
            user        = self._username,
            password    = self._password,
            host        = self._host,
            port        = self._port,
            database    = self._database,
            client_flag = CLIENT.FOUND_ROWS,
            autocommit  = True,
        )
        return _Connection(conn, conn.cursor(dictionary=True))


    @property
    def _connection(self) -> _Connection:
        existing: _Connection | None = getattr(self._local, "connection", None)
        if existing is None:
            existing = self._open()
            self._local.connection = existing
        return existing


    def _reconnect(self) -> _Connection:
        stale: _Connection | None = getattr(self._local, "connection", None)
        if stale is not None:
            try:
                stale.conn.close()
            except mariadb.Error:
                pass
        fresh: _Connection = self._open()
        self._local.connection = fresh
        return fresh


    def execute(self, query: str, params: tuple = ()) -> list[dict]:
        try:
            connection: _Connection = self._connection
        except mariadb.Error as e:
            _logger.critical(f"Error connecting to MariaDB: {e}")
            raise

        try:
            connection.cursor.execute(query, params)
        except mariadb.IntegrityError as e:
            raise DuplicateRecordError(str(e)) from e
        except mariadb.InterfaceError:
            _logger.warning("MariaDB connection was stale, reconnecting")
            connection = self._reconnect()
            try:
                connection.cursor.execute(query, params)
            except mariadb.IntegrityError as e:
                # Same translation as the first attempt, so routers still get a 409
                # rather than a 500 when the retry is the one that hits the constraint.
                raise DuplicateRecordError(str(e)) from e

        try:
            return connection.cursor.fetchall()
        except mariadb.ProgrammingError:
            return []


    @contextmanager
    def transaction(self):
        """
        Explicit transaction on this thread's connection.

        The connection runs with autocommit on, so multi-statement work that must be
        atomic (read-then-write under a row lock) needs to say so. Safe only because
        connections are thread-confined — on a shared connection this would have
        wrapped whatever other requests happened to be running.
        """
        self.execute("START TRANSACTION;")
        try:
            yield self
        except BaseException:
            try:
                self.execute("ROLLBACK;")
            except mariadb.Error as e:
                _logger.error(f"Rollback failed: {e}")
            raise
        else:
            self.execute("COMMIT;")


    def verify(self) -> None:
        """Open a connection eagerly so a misconfigured database fails at startup."""
        self.execute(Queries.PING)


    @property
    def rowcount(self) -> int:
        return self._connection.cursor.rowcount


    @property
    def lastrowid(self) -> int:
        return self._connection.cursor.lastrowid


    def commit(self) -> None:
        self._connection.conn.commit()


    def close(self) -> None:
        existing: _Connection | None = getattr(self._local, "connection", None)
        if existing is None:
            return
        existing.cursor.close()
        existing.conn.close()
        self._local.connection = None
