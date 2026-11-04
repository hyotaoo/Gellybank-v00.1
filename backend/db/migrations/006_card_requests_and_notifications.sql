-- 006: Card approval workflow, full card details, and in-app notifications.

ALTER TABLE transaction_requests
    MODIFY transaction_type ENUM('DEPOSIT', 'WITHDRAWAL', 'CARD') NOT NULL;

ALTER TABLE bank_cards
    ADD COLUMN card_number VARCHAR(19) NULL UNIQUE AFTER card_number_token_or_last4,
    ADD COLUMN cvv VARCHAR(4) NULL AFTER card_number;

CREATE TABLE notifications (
    notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(120) NOT NULL,
    message VARCHAR(255) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    link VARCHAR(255) NULL,
    read_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES app_users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_notifications_user
    ON notifications(user_id, read_at, created_at);
