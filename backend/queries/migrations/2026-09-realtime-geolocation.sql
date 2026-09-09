ALTER TABLE alerts
    ADD COLUMN status ENUM('active', 'ended', 'expired') NOT NULL DEFAULT 'ended' AFTER longitude,
    ADD COLUMN tracking_expires_at DATETIME NULL AFTER status,
    ADD COLUMN tracking_ended_at DATETIME NULL AFTER tracking_expires_at,
    ADD COLUMN latest_latitude DOUBLE NULL AFTER tracking_ended_at,
    ADD COLUMN latest_longitude DOUBLE NULL AFTER latest_latitude,
    ADD COLUMN latest_accuracy DOUBLE NULL AFTER latest_longitude,
    ADD COLUMN latest_speed DOUBLE NULL AFTER latest_accuracy,
    ADD COLUMN latest_bearing DOUBLE NULL AFTER latest_speed,
    ADD COLUMN latest_sequence INT NOT NULL DEFAULT 0 AFTER latest_bearing,
    ADD COLUMN last_location_at DATETIME(3) NULL AFTER latest_sequence;

UPDATE alerts
SET latest_latitude = latitude,
    latest_longitude = longitude,
    last_location_at = created_at,
    tracking_ended_at = created_at;

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

INSERT INTO alert_locations (alert_id, sequence, latitude, longitude, recorded_at)
SELECT id, 0, latitude, longitude, created_at FROM alerts;
