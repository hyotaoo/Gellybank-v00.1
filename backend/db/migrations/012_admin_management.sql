-- 012: Staff display names and site-wide bank settings (name, contact, logo,
-- maintenance mode).

ALTER TABLE app_users
    ADD COLUMN display_name VARCHAR(100) NULL AFTER username;

CREATE TABLE bank_settings (
    setting_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bank_name VARCHAR(80) NOT NULL DEFAULT 'GellyBank',
    contact_email VARCHAR(254) NULL,
    contact_phone VARCHAR(20) NULL,
    address VARCHAR(255) NULL,
    logo_data MEDIUMTEXT NULL,
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_user_id BIGINT UNSIGNED NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
