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
    UPDATE_USER_PASSWORD: str = "UPDATE users SET password_hash = %s WHERE id = %s;"

    INSERT_CONTACT: str = "INSERT INTO contacts (user_id, name, phone, email) VALUES (%s, %s, %s, %s);"
    COUNT_CONTACTS_BY_USER: str = "SELECT COUNT(*) AS total FROM contacts WHERE user_id = %s;"
    # Taken inside a transaction before counting contacts, so two concurrent creates
    # for the same user run one after the other instead of both seeing "3 contacts".
    # Locks that user's row only — other users are unaffected.
    LOCK_USER: str = "SELECT id FROM users WHERE id = %s FOR UPDATE;"
    SELECT_CONTACTS_BY_USER: str = "SELECT id, name, phone, email, confirmed, (telegram_chat_id IS NOT NULL) AS telegram_linked, whatsapp_enabled, whatsapp_confirmed, sms_enabled FROM contacts WHERE user_id = %s;"
    SELECT_CONTACT_BY_ID: str = "SELECT id, name, phone, email, confirmed, (telegram_chat_id IS NOT NULL) AS telegram_linked, whatsapp_enabled, whatsapp_confirmed, sms_enabled FROM contacts WHERE id = %s AND user_id = %s;"
    SELECT_CONFIRMED_CONTACTS_BY_USER: str = "SELECT id, name, phone, email, confirmed, telegram_chat_id, whatsapp_enabled, whatsapp_confirmed, sms_enabled FROM contacts WHERE user_id = %s AND (confirmed = TRUE OR telegram_chat_id IS NOT NULL OR (whatsapp_enabled = TRUE AND whatsapp_confirmed = TRUE) OR sms_enabled = TRUE);"
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

    SET_CONTACT_WHATSAPP_ENABLED: str = "UPDATE contacts SET whatsapp_enabled = TRUE WHERE id = %s AND user_id = %s;"
    CLEAR_CONTACT_WHATSAPP: str = "UPDATE contacts SET whatsapp_enabled = FALSE, whatsapp_confirmed = FALSE WHERE id = %s AND user_id = %s;"
    SET_CONTACT_SMS_ENABLED: str = "UPDATE contacts SET sms_enabled = TRUE WHERE id = %s AND user_id = %s;"
    CLEAR_CONTACT_SMS: str = "UPDATE contacts SET sms_enabled = FALSE WHERE id = %s AND user_id = %s;"
    SELECT_WHATSAPP_ENABLED_CONTACTS_BY_PHONE: str = (
        "SELECT contacts.id, contacts.name AS contact_name, contacts.whatsapp_confirmed, users.name AS user_name "
        "FROM contacts JOIN users ON users.id = contacts.user_id "
        "WHERE contacts.whatsapp_enabled = TRUE AND REPLACE(contacts.phone, '+', '') = %s;"
    )
    CONFIRM_CONTACTS_WHATSAPP_BY_PHONE: str = (
        "UPDATE contacts SET whatsapp_confirmed = TRUE "
        "WHERE whatsapp_enabled = TRUE AND REPLACE(phone, '+', '') = %s;"
    )

    CONFIRM_USER: str = "UPDATE users SET confirmed = TRUE WHERE id = %s;"
    PURGE_UNCONFIRMED_USERS: str = "DELETE FROM users WHERE confirmed = FALSE AND created_at < (NOW() - INTERVAL 24 HOUR);"

    DELETE_ALERT_NOTIFICATIONS_BY_USER: str = "DELETE FROM alert_notifications WHERE alert_id IN (SELECT id FROM alerts WHERE user_id = %s);"
    DELETE_ALERT_VIDEOS_BY_USER: str = "DELETE FROM alert_videos WHERE alert_id IN (SELECT id FROM alerts WHERE user_id = %s);"
    SELECT_ALERT_VIDEO_PATHS_BY_USER: str = "SELECT local_path FROM alert_videos WHERE alert_id IN (SELECT id FROM alerts WHERE user_id = %s);"
    DELETE_SOCIAL_CONNECTIONS_BY_USER: str = "DELETE FROM social_connections WHERE user_id = %s;"
    DELETE_ALERTS_BY_USER: str = "DELETE FROM alerts WHERE user_id = %s;"
    DELETE_CONTACTS_BY_USER: str = "DELETE FROM contacts WHERE user_id = %s;"
    DELETE_USER_BY_ID: str = "DELETE FROM users WHERE id = %s;"

    INSERT_ALERT: str = (
        "INSERT INTO alerts "
        "(user_id, created_at, latitude, longitude, status, tracking_expires_at, latest_latitude, latest_longitude, "
        "latest_accuracy, latest_speed, latest_bearing, latest_sequence, last_location_at) "
        "VALUES (%s, %s, %s, %s, 'active', %s, %s, %s, %s, %s, %s, 0, %s);"
    )
    SELECT_ALERTS_BY_USER: str = (
        "SELECT id, created_at, latitude, longitude, status, tracking_expires_at, "
        "tracking_ended_at, latest_latitude, latest_longitude, latest_accuracy, last_location_at "
        "FROM alerts WHERE user_id = %s ORDER BY created_at DESC;"
    )

    INSERT_ALERT_LOCATION: str = (
        "INSERT IGNORE INTO alert_locations "
        "(alert_id, sequence, latitude, longitude, accuracy, speed, bearing, recorded_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s);"
    )
    UPDATE_ALERT_LATEST_LOCATION: str = (
        "UPDATE alerts SET latest_latitude = %s, latest_longitude = %s, latest_accuracy = %s, "
        "latest_speed = %s, latest_bearing = %s, latest_sequence = %s, last_location_at = %s "
        "WHERE id = %s AND user_id = %s AND status = 'active' "
        "AND tracking_expires_at > UTC_TIMESTAMP() AND latest_sequence < %s;"
    )
    SELECT_ALERT_PUBLISH_STATE: str = (
        "SELECT id, user_id, status, tracking_expires_at, latest_sequence "
        "FROM alerts WHERE id = %s AND user_id = %s;"
    )
    SELECT_ALERT_VIEW_BY_OWNER: str = (
        "SELECT alerts.id AS alert_id, alerts.status, alerts.tracking_expires_at, alerts.tracking_ended_at, "
        "alerts.latest_latitude, alerts.latest_longitude, alerts.latest_accuracy, alerts.latest_speed, "
        "alerts.latest_bearing, alerts.latest_sequence, alerts.last_location_at, alerts.created_at, "
        "users.name AS user_name, users.phone AS user_phone "
        "FROM alerts JOIN users ON users.id = alerts.user_id "
        "WHERE alerts.id = %s AND alerts.user_id = %s;"
    )
    STOP_ALERT_TRACKING: str = (
        "UPDATE alerts SET status = 'ended', tracking_ended_at = UTC_TIMESTAMP() "
        "WHERE id = %s AND user_id = %s AND status = 'active';"
    )
    EXPIRE_ALERT_TRACKING: str = (
        "UPDATE alerts SET status = 'expired', tracking_ended_at = COALESCE(tracking_ended_at, tracking_expires_at) "
        "WHERE id = %s AND status = 'active' AND tracking_expires_at <= UTC_TIMESTAMP();"
    )
    SELECT_ALERT_LOCATIONS: str = (
        "SELECT sequence, latitude, longitude, accuracy, speed, bearing, recorded_at "
        "FROM (SELECT sequence, latitude, longitude, accuracy, speed, bearing, recorded_at "
        "FROM alert_locations WHERE alert_id = %s ORDER BY sequence DESC LIMIT 500) recent "
        "ORDER BY sequence ASC;"
    )

    INSERT_ALERT_NOTIFICATION: str = (
        "INSERT INTO alert_notifications "
        "(alert_id, contact_id, contact_name, channel, view_token_hash, view_token_expires_at) "
        "VALUES (%s, %s, %s, %s, %s, %s);"
    )
    SELECT_ALERT_NOTIFICATIONS_BY_ALERT: str = (
        "SELECT alert_notifications.channel, alert_notifications.viewed_at, alert_notifications.contact_name, "
        "(alert_notifications.contact_id IS NULL) AS contact_removed "
        "FROM alert_notifications "
        "WHERE alert_notifications.alert_id = %s ORDER BY alert_notifications.contact_name;"
    )
    # One query for every notification belonging to one user's alerts, so listing
    # alerts costs 2 queries instead of 1-per-alert. The contact name is stored on
    # the row, so an alert keeps its recipients even after a contact is deleted.
    SELECT_ALERT_NOTIFICATIONS_BY_USER: str = (
        "SELECT alert_notifications.alert_id, alert_notifications.channel, alert_notifications.viewed_at, "
        "alert_notifications.contact_name, (alert_notifications.contact_id IS NULL) AS contact_removed "
        "FROM alert_notifications "
        "JOIN alerts ON alerts.id = alert_notifications.alert_id "
        "WHERE alerts.user_id = %s ORDER BY alert_notifications.contact_name;"
    )
    SELECT_ALERT_NOTIFICATION_BY_ID: str = (
        "SELECT alert_notifications.id, alert_notifications.alert_id, alert_notifications.viewed_at, "
        "alerts.latitude, alerts.longitude, alerts.status, alerts.tracking_expires_at, alerts.tracking_ended_at, "
        "alerts.latest_latitude, alerts.latest_longitude, alerts.latest_accuracy, alerts.latest_speed, "
        "alerts.latest_bearing, alerts.latest_sequence, alerts.last_location_at, alerts.created_at, "
        "users.name AS user_name, users.phone AS user_phone "
        "FROM alert_notifications JOIN alerts ON alerts.id = alert_notifications.alert_id "
        "JOIN users ON users.id = alerts.user_id "
        "WHERE alert_notifications.id = %s;"
    )
    SELECT_ALERT_NOTIFICATION_ID_BY_SHORT_TOKEN_HASH: str = (
        "SELECT id FROM alert_notifications "
        "WHERE view_token_hash = %s AND view_token_expires_at > UTC_TIMESTAMP();"
    )
    MARK_ALERT_NOTIFICATION_VIEWED: str = "UPDATE alert_notifications SET viewed_at = NOW() WHERE id = %s AND viewed_at IS NULL;"

    SELECT_SOCIAL_CONNECTION: str = "SELECT user_id, provider, access_token, refresh_token, expires_at, scopes FROM social_connections WHERE user_id = %s AND provider = %s;"
    UPSERT_SOCIAL_CONNECTION: str = (
        "INSERT INTO social_connections (user_id, provider, access_token, refresh_token, expires_at, scopes) "
        "VALUES (%s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), "
        "refresh_token = VALUES(refresh_token), expires_at = VALUES(expires_at), scopes = VALUES(scopes);"
    )
    DELETE_SOCIAL_CONNECTION: str = "DELETE FROM social_connections WHERE user_id = %s AND provider = %s;"
    SELECT_ALERT_ID_BY_USER: str = "SELECT id FROM alerts WHERE id = %s AND user_id = %s;"
    SELECT_ALERT_VIDEO: str = "SELECT alert_id, status, mime_type, byte_size, duration_seconds, local_path, drive_status, drive_started_at, drive_file_id, drive_url, tiktok_publish_id, tiktok_status, tiktok_fail_reason FROM alert_videos WHERE alert_id = %s;"
    INSERT_ALERT_VIDEO: str = "INSERT INTO alert_videos (alert_id, status, mime_type, byte_size, duration_seconds, local_path) VALUES (%s, 'ready', %s, %s, %s, %s);"
    MARK_ALERT_VIDEO_DRIVE_UPLOADING: str = "UPDATE alert_videos SET drive_status = 'uploading', drive_started_at = UTC_TIMESTAMP() WHERE alert_id = %s;"
    MARK_ALERT_VIDEO_READY: str = "UPDATE alert_videos SET drive_status = 'ready', drive_started_at = NULL, drive_file_id = %s, drive_url = %s WHERE alert_id = %s;"
    MARK_ALERT_VIDEO_FAILED: str = "UPDATE alert_videos SET drive_status = 'failed', drive_started_at = NULL WHERE alert_id = %s;"
    SET_ALERT_VIDEO_TIKTOK: str = "UPDATE alert_videos SET tiktok_publish_id = %s, tiktok_status = %s, tiktok_fail_reason = NULL WHERE alert_id = %s;"
    UPDATE_ALERT_VIDEO_TIKTOK_STATUS: str = "UPDATE alert_videos SET tiktok_status = %s, tiktok_fail_reason = %s WHERE alert_id = %s;"


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
