USE gellybank_db;

ALTER TABLE app_users
    ADD COLUMN auth_token_version INT NOT NULL DEFAULT 0 AFTER is_active;

ALTER TABLE audit_logs
    ADD COLUMN severity ENUM('INFO', 'WARN', 'ERROR')
        NOT NULL DEFAULT 'INFO' AFTER action;

CREATE TABLE account_applications (
    application_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    applicant_user_id BIGINT UNSIGNED NOT NULL,
    account_type_id SMALLINT UNSIGNED NOT NULL,
    initial_deposit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    account_label VARCHAR(40) NULL,
    make_primary BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    rejection_reason VARCHAR(500) NULL,
    created_account_id BIGINT UNSIGNED NULL,
    reviewed_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    CONSTRAINT fk_application_customer
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_application_applicant
        FOREIGN KEY (applicant_user_id) REFERENCES app_users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_application_type
        FOREIGN KEY (account_type_id) REFERENCES account_types(account_type_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_application_created_account
        FOREIGN KEY (created_account_id) REFERENCES bank_accounts(account_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_application_reviewer
        FOREIGN KEY (reviewed_by_user_id) REFERENCES app_users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_application_status_date
    ON account_applications(status, created_at);

CREATE TABLE password_reset_tokens (
    reset_token_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_reset_user
        FOREIGN KEY (user_id) REFERENCES app_users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_password_reset_user
    ON password_reset_tokens(user_id);
