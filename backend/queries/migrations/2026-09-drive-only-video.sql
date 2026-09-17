-- Convert the previous server-storage/TikTok video schema to Drive-only streaming.
-- Successful Drive links are retained. Incomplete local-only video metadata is removed.

DELETE FROM social_connections WHERE provider = 'tiktok';

ALTER TABLE social_connections
    MODIFY COLUMN provider ENUM('google') NOT NULL;

ALTER TABLE alert_videos
    ADD COLUMN IF NOT EXISTS drive_started_at DATETIME AFTER drive_status;

DELETE FROM alert_videos WHERE drive_status <> 'ready';

ALTER TABLE alert_videos
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS mime_type,
    DROP COLUMN IF EXISTS byte_size,
    DROP COLUMN IF EXISTS local_path,
    DROP COLUMN IF EXISTS tiktok_publish_id,
    DROP COLUMN IF EXISTS tiktok_status,
    DROP COLUMN IF EXISTS tiktok_fail_reason,
    MODIFY COLUMN drive_status ENUM('uploading', 'ready', 'failed') NOT NULL DEFAULT 'uploading';
