CREATE TABLE users (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    phone         VARCHAR(20)  NOT NULL UNIQUE,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    confirmed     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_unconfirmed (confirmed, created_at)
);


CREATE TABLE contacts (
    id                        INT          AUTO_INCREMENT PRIMARY KEY,
    user_id                   INT          NOT NULL,
    name                      VARCHAR(100) NOT NULL,
    phone                     VARCHAR(20)  NOT NULL,
    email                     VARCHAR(120),
    confirmed                 BOOLEAN      NOT NULL DEFAULT FALSE,
    telegram_chat_id          BIGINT,
    telegram_link_token       VARCHAR(64),
    telegram_link_expires_at  DATETIME,
    whatsapp_enabled          BOOLEAN      NOT NULL DEFAULT FALSE,
    whatsapp_confirmed        BOOLEAN      NOT NULL DEFAULT FALSE,
    sms_enabled               BOOLEAN      NOT NULL DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE INDEX idx_contacts_telegram_link_token (telegram_link_token)
);


CREATE TABLE alerts (
    id                  INT      AUTO_INCREMENT PRIMARY KEY,
    user_id             INT      NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    latitude            DOUBLE   NOT NULL,
    longitude           DOUBLE   NOT NULL,
    status              ENUM('active', 'ended', 'expired') NOT NULL DEFAULT 'active',
    tracking_expires_at DATETIME NOT NULL,
    tracking_ended_at   DATETIME,
    latest_latitude     DOUBLE   NOT NULL,
    latest_longitude    DOUBLE   NOT NULL,
    latest_accuracy     DOUBLE,
    latest_speed        DOUBLE,
    latest_bearing      DOUBLE,
    latest_sequence     INT      NOT NULL DEFAULT 0,
    last_location_at    DATETIME(3) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);


CREATE TABLE alert_locations (
    id          BIGINT      AUTO_INCREMENT PRIMARY KEY,
    alert_id    INT         NOT NULL,
    sequence    INT         NOT NULL,
    latitude    DOUBLE      NOT NULL,
    longitude   DOUBLE      NOT NULL,
    accuracy    DOUBLE,
    speed       DOUBLE,
    bearing     DOUBLE,
    recorded_at DATETIME(3) NOT NULL,
    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_alert_locations_sequence (alert_id, sequence),
    INDEX idx_alert_locations_time (alert_id, recorded_at)
);


CREATE TABLE alert_notifications (
    id           INT                       AUTO_INCREMENT PRIMARY KEY,
    alert_id     INT                       NOT NULL,
    contact_id   INT,
    contact_name VARCHAR(100),
    channel      ENUM('email', 'telegram', 'whatsapp', 'sms') NOT NULL,
    viewed_at    DATETIME,
    FOREIGN KEY (alert_id) REFERENCES alerts(id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);
