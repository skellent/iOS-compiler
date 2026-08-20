ALTER TABLE alert_notifications
    ADD COLUMN contact_name VARCHAR(100);

UPDATE alert_notifications an
    JOIN contacts c ON c.id = an.contact_id
    SET an.contact_name = c.name
    WHERE an.contact_name IS NULL;

SET @fk := (
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'alert_notifications'
      AND COLUMN_NAME = 'contact_id'
      AND REFERENCED_TABLE_NAME = 'contacts'
    LIMIT 1
);
SET @sql := CONCAT('ALTER TABLE alert_notifications DROP FOREIGN KEY `', @fk, '`');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE alert_notifications MODIFY contact_id INT NULL;

ALTER TABLE alert_notifications
    ADD CONSTRAINT alert_notifications_contact_fk
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
