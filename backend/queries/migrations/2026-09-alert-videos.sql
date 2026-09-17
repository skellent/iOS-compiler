CREATE TABLE social_connections (
    user_id INT NOT NULL,
    provider ENUM('google') NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at DATETIME NOT NULL,
    scopes TEXT,
    PRIMARY KEY (user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE alert_videos (
    alert_id INT PRIMARY KEY,
    duration_seconds SMALLINT NOT NULL,
    drive_status ENUM('uploading', 'ready', 'failed') NOT NULL DEFAULT 'uploading',
    drive_started_at DATETIME,
    drive_file_id VARCHAR(128),
    drive_url VARCHAR(512),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);
