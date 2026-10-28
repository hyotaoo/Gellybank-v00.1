USE gellybank_db;

CREATE TABLE beneficiaries (
    beneficiary_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    bank VARCHAR(100) NULL,
    created_at DATETIME NULL,
    CONSTRAINT fk_beneficiaries_customer
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_beneficiaries_customer
    ON beneficiaries(customer_id);
