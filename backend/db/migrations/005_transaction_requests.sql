-- 005: Customer deposit/withdraw requests reviewed (approved/rejected) by tellers.

CREATE TABLE transaction_requests (
    request_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,
    requested_by_user_id BIGINT UNSIGNED NOT NULL,
    transaction_type ENUM('DEPOSIT', 'WITHDRAWAL') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    note VARCHAR(255) NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
        NOT NULL DEFAULT 'PENDING',
    rejection_reason VARCHAR(500) NULL,
    reviewed_by_user_id BIGINT UNSIGNED NULL,
    transaction_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,

    CONSTRAINT fk_tx_requests_customer
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_tx_requests_account
        FOREIGN KEY (account_id) REFERENCES bank_accounts(account_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_tx_requests_requested_by
        FOREIGN KEY (requested_by_user_id) REFERENCES app_users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_tx_requests_reviewed_by
        FOREIGN KEY (reviewed_by_user_id) REFERENCES app_users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tx_requests_transaction
        FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_tx_requests_status_date
    ON transaction_requests(status, created_at);

CREATE INDEX idx_tx_requests_customer
    ON transaction_requests(customer_id, status);

CREATE INDEX idx_tx_requests_account
    ON transaction_requests(account_id, status);
