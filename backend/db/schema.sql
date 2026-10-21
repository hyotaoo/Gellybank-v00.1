-- Gellybank database schema (MySQL 8), matching the backend models.
--
-- Fresh setup:  open MySQL Workbench (or the mysql client) and run this file.
-- Existing database: you only need the two "added" pieces marked below
--   (transactions.status and the beneficiaries table).

CREATE DATABASE IF NOT EXISTS gelly_bank_v1
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gelly_bank_v1;

CREATE TABLE IF NOT EXISTS customers (
  customer_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(50)  NOT NULL,
  middle_name   VARCHAR(50)  NULL,
  last_name     VARCHAR(50)  NOT NULL,
  date_of_birth DATE         NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,
  phone         VARCHAR(20)  NULL,
  address       VARCHAR(255) NULL,
  status        ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_users (
  user_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id   BIGINT UNSIGNED NULL UNIQUE,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('ADMIN','TELLER','CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_users_customer FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_types (
  account_type_id      SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_name            VARCHAR(30) NOT NULL UNIQUE,
  description          VARCHAR(255) NULL,
  minimum_balance      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  default_interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_accounts (
  account_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id     BIGINT UNSIGNED   NOT NULL,
  account_type_id SMALLINT UNSIGNED NOT NULL,
  account_number  VARCHAR(20)  NOT NULL UNIQUE,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  interest_rate   DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  status          ENUM('ACTIVE','FROZEN','CLOSED') NOT NULL DEFAULT 'ACTIVE',
  opened_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at       TIMESTAMP NULL,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_customer FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id) ON UPDATE CASCADE,
  CONSTRAINT fk_accounts_type FOREIGN KEY (account_type_id)
    REFERENCES account_types(account_type_id) ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transfers (
  transfer_id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference_code       VARCHAR(40) NOT NULL UNIQUE,
  from_account_id      BIGINT UNSIGNED NOT NULL,
  to_account_id        BIGINT UNSIGNED NOT NULL,
  amount               DECIMAL(15,2) NOT NULL,
  status               ENUM('PENDING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  initiated_by_user_id BIGINT UNSIGNED NULL,
  description          VARCHAR(255) NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at         TIMESTAMP NULL,
  CONSTRAINT fk_transfers_from FOREIGN KEY (from_account_id)
    REFERENCES bank_accounts(account_id) ON UPDATE CASCADE,
  CONSTRAINT fk_transfers_to FOREIGN KEY (to_account_id)
    REFERENCES bank_accounts(account_id) ON UPDATE CASCADE,
  CONSTRAINT fk_transfers_user FOREIGN KEY (initiated_by_user_id)
    REFERENCES app_users(user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  transaction_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id           BIGINT UNSIGNED NOT NULL,
  transfer_id          BIGINT UNSIGNED NULL,
  transaction_type     ENUM('DEPOSIT','WITHDRAWAL','TRANSFER_IN','TRANSFER_OUT','ADJUSTMENT') NOT NULL,
  amount               DECIMAL(15,2) NOT NULL,
  balance_after        DECIMAL(15,2) NOT NULL,
  reference_code       VARCHAR(40) NOT NULL UNIQUE,
  description          VARCHAR(255) NULL,
  performed_by_user_id BIGINT UNSIGNED NULL,
  -- Added so a transaction can be "voided" from the app.
  status               ENUM('PENDING','COMPLETED','FAILED','VOID') NOT NULL DEFAULT 'COMPLETED',
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_account FOREIGN KEY (account_id)
    REFERENCES bank_accounts(account_id) ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_transfer FOREIGN KEY (transfer_id)
    REFERENCES transfers(transfer_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_user FOREIGN KEY (performed_by_user_id)
    REFERENCES app_users(user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_cards (
  card_id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id                 BIGINT UNSIGNED NOT NULL,
  card_number_token_or_last4 VARCHAR(100) NOT NULL UNIQUE,
  card_type                  ENUM('DEBIT','ATM') NOT NULL DEFAULT 'DEBIT',
  status                     ENUM('ACTIVE','BLOCKED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  issued_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_on                 DATE NULL,
  blocked_at                 DATETIME NULL,
  cancelled_at               DATETIME NULL,
  CONSTRAINT fk_cards_account FOREIGN KEY (account_id)
    REFERENCES bank_accounts(account_id) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Added: saved transfer recipients.
CREATE TABLE IF NOT EXISTS beneficiaries (
  beneficiary_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id    BIGINT UNSIGNED NOT NULL,
  name           VARCHAR(100) NOT NULL,
  account_number VARCHAR(30)  NOT NULL,
  bank           VARCHAR(100) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_beneficiaries_customer FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- The two account kinds the app offers.
INSERT IGNORE INTO account_types (type_name, description, minimum_balance, default_interest_rate)
VALUES
  ('SAVINGS'),
  ('CHECKING');
