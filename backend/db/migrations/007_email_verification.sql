-- 007: Email verification for new customer accounts.

ALTER TABLE app_users
    ADD COLUMN email_verified_at DATETIME NULL AFTER is_active;

-- Accounts that already existed before verification was introduced stay usable.
UPDATE app_users
SET email_verified_at = created_at
WHERE email_verified_at IS NULL
  AND created_at < '2026-11-04 00:00:00';

CREATE TABLE email_verification_tokens (
    verification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    code_hash CHAR(64) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_email_verification_user
        FOREIGN KEY (user_id) REFERENCES app_users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_email_verification_user
    ON email_verification_tokens(user_id);
