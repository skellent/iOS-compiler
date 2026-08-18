ALTER TABLE contacts
    ADD COLUMN sms_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE alert_notifications
    MODIFY COLUMN channel ENUM('email', 'telegram', 'whatsapp', 'sms') NOT NULL;
