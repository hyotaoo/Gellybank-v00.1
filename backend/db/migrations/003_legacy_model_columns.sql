USE gellybank_db;

ALTER TABLE transactions
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED';

ALTER TABLE account_applications
    ADD COLUMN created_account_id BIGINT UNSIGNED NULL;

ALTER TABLE account_applications
    ADD CONSTRAINT fk_application_created_account
    FOREIGN KEY (created_account_id)
    REFERENCES bank_accounts(account_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
