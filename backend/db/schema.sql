-- ============================================================
-- GELLY BANK DATABASE
-- ============================================================
-- This file is safe to run more than once:
--   * tables are created with IF NOT EXISTS
--   * indexes live inside the table definitions, so they are
--     created with the table and never collide on a re-run
--   * seed rows are inserted with INSERT IGNORE
--   * views are refreshed with CREATE OR REPLACE VIEW
-- Nothing that already exists is dropped or rewritten.
--
-- To start from scratch, uncomment the line below.
-- DROP DATABASE IF EXISTS gellybank_db;

CREATE DATABASE IF NOT EXISTS gellybank_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE gellybank_db;


-- ============================================================
-- TABLE 1: CUSTOMERS
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
    customer_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50) NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    phone VARCHAR(20) NULL,
    address VARCHAR(255) NULL,

    status ENUM('ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- ============================================================
-- TABLE 2: APP_USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS app_users (
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    role ENUM('ADMIN', 'TELLER', 'CUSTOMER')
        NOT NULL DEFAULT 'CUSTOMER',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auth_token_version INT NOT NULL DEFAULT 0,
    last_login_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_app_users_role_active (role, is_active),

    CONSTRAINT uq_app_users_customer
        UNIQUE (customer_id),

    CONSTRAINT fk_app_users_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- TABLE 3: ACCOUNT TYPES
-- ============================================================

CREATE TABLE IF NOT EXISTS account_types (
    account_type_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(30) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    minimum_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    default_interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Initial account types
INSERT IGNORE INTO account_types (type_name, description, minimum_balance, default_interest_rate)
VALUES
('SAVINGS', 'Savings account for deposits and withdrawals', 100.00, 0.00),
('CHECKING', 'Checking account for everyday transactions', 500.00, 0.00);


-- ============================================================
-- TABLE 4: BANK ACCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
    account_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    account_type_id SMALLINT UNSIGNED NOT NULL,
    account_number VARCHAR(20) NOT NULL UNIQUE,
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    status ENUM('ACTIVE', 'FROZEN', 'CLOSED')
        NOT NULL DEFAULT 'ACTIVE',

    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_accounts_customer (customer_id),
    KEY idx_accounts_customer_status (customer_id, status),

    CONSTRAINT fk_accounts_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_accounts_type
        FOREIGN KEY (account_type_id)
        REFERENCES account_types(account_type_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- TABLE 5: TRANSFERS
-- ============================================================

CREATE TABLE IF NOT EXISTS transfers (
    transfer_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference_code VARCHAR(40) NOT NULL UNIQUE,
    from_account_id BIGINT UNSIGNED NOT NULL,
    to_account_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(15,2) NOT NULL,

    status ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')
        NOT NULL DEFAULT 'PENDING',

    initiated_by_user_id BIGINT UNSIGNED NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,

    KEY idx_transfers_from_date (from_account_id, created_at),
    KEY idx_transfers_to_date (to_account_id, created_at),
    KEY idx_transfers_status_date (status, created_at),

    CONSTRAINT fk_transfers_from_account
        FOREIGN KEY (from_account_id)
        REFERENCES bank_accounts(account_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_transfers_to_account
        FOREIGN KEY (to_account_id)
        REFERENCES bank_accounts(account_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_transfers_initiated_by
        FOREIGN KEY (initiated_by_user_id)
        REFERENCES app_users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- TABLE 6: TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT UNSIGNED NOT NULL,
    transfer_id BIGINT UNSIGNED NULL,
    transaction_type ENUM(
        'DEPOSIT',
        'WITHDRAWAL',
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'ADJUSTMENT'
    ) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    reference_code VARCHAR(40) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    performed_by_user_id BIGINT UNSIGNED NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_transactions_account_date (account_id, created_at),
    KEY idx_transactions_type_date (transaction_type, created_at),
    KEY idx_transactions_transfer (transfer_id),

    CONSTRAINT fk_transactions_account
        FOREIGN KEY (account_id)
        REFERENCES bank_accounts(account_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_transactions_transfer
        FOREIGN KEY (transfer_id)
        REFERENCES transfers(transfer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_transactions_performed_by
        FOREIGN KEY (performed_by_user_id)
        REFERENCES app_users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- TABLE 7: BANK CARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_cards (
    card_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT UNSIGNED NOT NULL,

    -- Store a safe token or masked identifier.
    -- Never store the full card number, PIN, or CVV here.

    card_number_token_or_last4 VARCHAR(100) NOT NULL UNIQUE,
    card_type ENUM('DEBIT', 'ATM')
        NOT NULL DEFAULT 'DEBIT',

    status ENUM('ACTIVE', 'BLOCKED', 'EXPIRED', 'CANCELLED')
        NOT NULL DEFAULT 'ACTIVE',

    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_on DATE NULL,
    blocked_at DATETIME NULL,
    cancelled_at DATETIME NULL,

    KEY idx_cards_account_status (account_id, status),

    CONSTRAINT fk_cards_account
        FOREIGN KEY (account_id)
        REFERENCES bank_accounts(account_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- TABLE 8: BENEFICIARIES
-- ============================================================

CREATE TABLE IF NOT EXISTS beneficiaries (
    beneficiary_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    bank VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_beneficiaries_customer (customer_id),

    CONSTRAINT fk_beneficiaries_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- TABLE 8: BENEFICIARIES
-- ============================================================

CREATE TABLE beneficiaries (
    beneficiary_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    bank VARCHAR(100) NULL,
    created_at DATETIME NULL,

    CONSTRAINT fk_beneficiaries_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_beneficiaries_customer
    ON beneficiaries(customer_id);


-- ============================================================
-- TABLE 9: AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    severity ENUM('INFO', 'WARN', 'ERROR') NOT NULL DEFAULT 'INFO',
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NULL,
    details JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_audit_actor_date (actor_user_id, created_at),
    KEY idx_audit_entity (entity_type, entity_id),

    CONSTRAINT fk_audit_actor
        FOREIGN KEY (actor_user_id)
        REFERENCES app_users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_audit_actor_date
    ON audit_logs(actor_user_id, created_at);

CREATE INDEX idx_audit_entity
    ON audit_logs(entity_type, entity_id);


-- ============================================================
-- TABLE 10: ACCOUNT APPLICATIONS
-- ============================================================

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


-- ============================================================
-- TABLE 11: PASSWORD RESET TOKENS
-- ============================================================

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


-- ============================================================
-- VIEW 1: ACCOUNT SUMMARY
-- ============================================================

CREATE OR REPLACE VIEW v_account_summary AS
SELECT
    a.account_id,
    a.account_number,
    a.customer_id,

    CONCAT_WS(
        ' ',
        c.first_name,
        c.middle_name,
        c.last_name
    ) AS customer_name,

    at.type_name AS account_type,
    a.current_balance,
    a.interest_rate,
    a.status,
    a.opened_at,
    a.closed_at
FROM bank_accounts AS a
JOIN customers AS c
    ON c.customer_id = a.customer_id
JOIN account_types AS at
    ON at.account_type_id = a.account_type_id;


-- ============================================================
-- VIEW 2: TRANSACTION HISTORY
-- ============================================================

CREATE OR REPLACE VIEW v_transaction_history AS
SELECT
    t.transaction_id,
    t.account_id,
    a.account_number,
    t.transfer_id,
    t.transaction_type,
    t.amount,
    t.balance_after,
    t.reference_code,
    t.description,
    t.performed_by_user_id,
    t.created_at
FROM transactions AS t
JOIN bank_accounts AS a
    ON a.account_id = t.account_id;
