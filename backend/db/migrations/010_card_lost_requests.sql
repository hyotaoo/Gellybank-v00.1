-- 010: Allow customers to report a lost card through the request queue.

ALTER TABLE transaction_requests
    MODIFY transaction_type ENUM('DEPOSIT', 'WITHDRAWAL', 'CARD', 'CARD_LOST') NOT NULL;
