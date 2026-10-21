-- Gellybank database schema.
-- Run with:  python init_db.py   (reads DATABASE_URL from backend/.env)
-- The database itself is created by init_db.py - this file only defines tables.

CREATE TABLE IF NOT EXISTS customers (
    customer_id   BIGINT       NOT NULL AUTO_INCREMENT,
    first_name    VARCHAR(50)  NOT NULL,
    middle_name   VARCHAR(50)  NULL,
    last_name     VARCHAR(50)  NOT NULL,
    date_of_birth DATE         NULL,
    email         VARCHAR(254) NOT NULL,
    phone         VARCHAR(20)  NULL,
    address       VARCHAR(255) NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at    DATETIME     NULL,
    updated_at    DATETIME     NULL,
    PRIMARY KEY (customer_id),
    UNIQUE KEY uq_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_users (
    user_id        BIGINT       NOT NULL AUTO_INCREMENT,
    customer_id    BIGINT       NULL,
    username       VARCHAR(50)  NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           VARCHAR(20)  NOT NULL DEFAULT 'CUSTOMER',
    is_active      TINYINT(1)   NOT NULL DEFAULT 1,
    last_login_at  DATETIME     NULL,
    created_at     DATETIME     NULL,
    updated_at     DATETIME     NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_app_users_username (username),
    KEY ix_app_users_customer (customer_id),
    CONSTRAINT fk_app_users_customer FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_types (
    account_type_id       SMALLINT     NOT NULL AUTO_INCREMENT,
    type_name             VARCHAR(30)  NOT NULL,
    description           VARCHAR(255) NULL,
    minimum_balance       DECIMAL(15,2) NOT NULL DEFAULT 0,
    default_interest_rate DECIMAL(5,2)  NOT NULL DEFAULT 0,
    created_at            DATETIME     NULL,
    PRIMARY KEY (account_type_id),
    UNIQUE KEY uq_account_types_name (type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bank_accounts (
    account_id      BIGINT        NOT NULL AUTO_INCREMENT,
    customer_id     BIGINT        NOT NULL,
    account_type_id SMALLINT      NOT NULL,
    account_number  VARCHAR(20)   NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    interest_rate   DECIMAL(5,2)  NOT NULL DEFAULT 0,
    status          VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    opened_at       DATETIME      NULL,
    closed_at       DATETIME      NULL,
    updated_at      DATETIME      NULL,
    PRIMARY KEY (account_id),
    UNIQUE KEY uq_bank_accounts_number (account_number),
    KEY ix_bank_accounts_customer (customer_id),
    KEY ix_bank_accounts_type (account_type_id),
    CONSTRAINT fk_bank_accounts_customer FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id),
    CONSTRAINT fk_bank_accounts_type FOREIGN KEY (account_type_id)
        REFERENCES account_types (account_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transfers (
    transfer_id          BIGINT        NOT NULL AUTO_INCREMENT,
    reference_code       VARCHAR(40)   NOT NULL,
    from_account_id      BIGINT        NOT NULL,
    to_account_id        BIGINT        NOT NULL,
    amount               DECIMAL(15,2) NOT NULL,
    status               VARCHAR(20)   NOT NULL DEFAULT 'COMPLETED',
    initiated_by_user_id BIGINT        NULL,
    description          VARCHAR(255)  NULL,
    created_at           DATETIME      NULL,
    completed_at         DATETIME      NULL,
    PRIMARY KEY (transfer_id),
    UNIQUE KEY uq_transfers_reference (reference_code),
    KEY ix_transfers_from (from_account_id),
    KEY ix_transfers_to (to_account_id),
    KEY ix_transfers_user (initiated_by_user_id),
    CONSTRAINT fk_transfers_from FOREIGN KEY (from_account_id)
        REFERENCES bank_accounts (account_id),
    CONSTRAINT fk_transfers_to FOREIGN KEY (to_account_id)
        REFERENCES bank_accounts (account_id),
    CONSTRAINT fk_transfers_user FOREIGN KEY (initiated_by_user_id)
        REFERENCES app_users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id        BIGINT        NOT NULL AUTO_INCREMENT,
    account_id            BIGINT        NOT NULL,
    transfer_id           BIGINT        NULL,
    transaction_type      VARCHAR(20)   NOT NULL,
    amount                DECIMAL(15,2) NOT NULL,
    balance_after         DECIMAL(15,2) NOT NULL,
    reference_code        VARCHAR(40)   NOT NULL,
    description           VARCHAR(255)  NULL,
    performed_by_user_id  BIGINT        NULL,
    status                VARCHAR(20)   NOT NULL DEFAULT 'COMPLETED',
    created_at            DATETIME      NULL,
    PRIMARY KEY (transaction_id),
    UNIQUE KEY uq_transactions_reference (reference_code),
    KEY ix_transactions_account (account_id),
    KEY ix_transactions_transfer (transfer_id),
    KEY ix_transactions_user (performed_by_user_id),
    CONSTRAINT fk_transactions_account FOREIGN KEY (account_id)
        REFERENCES bank_accounts (account_id),
    CONSTRAINT fk_transactions_transfer FOREIGN KEY (transfer_id)
        REFERENCES transfers (transfer_id),
    CONSTRAINT fk_transactions_user FOREIGN KEY (performed_by_user_id)
        REFERENCES app_users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bank_cards (
    card_id                       BIGINT       NOT NULL AUTO_INCREMENT,
    account_id                    BIGINT       NOT NULL,
    card_number_token_or_last4    VARCHAR(100) NOT NULL,
    card_type                     VARCHAR(20)  NOT NULL DEFAULT 'DEBIT',
    status                        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    issued_at                     DATETIME     NULL,
    expires_on                    DATE         NULL,
    blocked_at                    DATETIME     NULL,
    cancelled_at                  DATETIME     NULL,
    PRIMARY KEY (card_id),
    UNIQUE KEY uq_bank_cards_token (card_number_token_or_last4),
    KEY ix_bank_cards_account (account_id),
    CONSTRAINT fk_bank_cards_account FOREIGN KEY (account_id)
        REFERENCES bank_accounts (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS beneficiaries (
    beneficiary_id BIGINT       NOT NULL AUTO_INCREMENT,
    customer_id    BIGINT       NOT NULL,
    name           VARCHAR(100) NOT NULL,
    account_number VARCHAR(30)  NOT NULL,
    bank           VARCHAR(100) NULL,
    created_at     DATETIME     NULL,
    PRIMARY KEY (beneficiary_id),
    KEY ix_beneficiaries_customer (customer_id),
    CONSTRAINT fk_beneficiaries_customer FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the account types required by app.py (add_demo_data / create_account).
INSERT INTO account_types (type_name, description, minimum_balance, default_interest_rate, created_at)
VALUES
    ('SAVINGS'),
    ('CHECKING')
ON DUPLICATE KEY UPDATE type_name = type_name;
