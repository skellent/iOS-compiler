ALTER TABLE contacts
    ADD COLUMN whatsapp_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN whatsapp_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE alert_notifications
    MODIFY COLUMN channel ENUM('email', 'telegram', 'whatsapp') NOT NULL;
