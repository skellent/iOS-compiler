-- Apply after 2026-09-alert-videos.sql on installations that created
-- alert_videos before the Drive retry timestamp was added.
ALTER TABLE alert_videos
    ADD COLUMN IF NOT EXISTS drive_started_at DATETIME AFTER drive_status;
