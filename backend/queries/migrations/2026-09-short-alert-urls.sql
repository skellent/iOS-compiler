ALTER TABLE alert_notifications
    ADD COLUMN view_token_hash BINARY(32) NULL AFTER viewed_at,
    ADD COLUMN view_token_expires_at DATETIME NULL AFTER view_token_hash,
    ADD UNIQUE INDEX idx_alert_notifications_view_token_hash (view_token_hash);
