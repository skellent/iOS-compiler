CREATE TABLE social_connections (
    user_id INT NOT NULL,
    provider ENUM('google', 'tiktok') NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at DATETIME NOT NULL,
    scopes TEXT,
    PRIMARY KEY (user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE alert_videos (
    alert_id INT PRIMARY KEY,
    status ENUM('ready', 'failed') NOT NULL DEFAULT 'ready',
    mime_type VARCHAR(32) NOT NULL,
    byte_size INT NOT NULL,
    local_path VARCHAR(512) NOT NULL,
    duration_seconds SMALLINT NOT NULL,
    drive_status ENUM('not_uploaded', 'uploading', 'ready', 'failed') NOT NULL DEFAULT 'not_uploaded',
    drive_started_at DATETIME,
    drive_file_id VARCHAR(128),
    drive_url VARCHAR(512),
    tiktok_publish_id VARCHAR(128),
    tiktok_status VARCHAR(32),
    tiktok_fail_reason VARCHAR(128),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);
