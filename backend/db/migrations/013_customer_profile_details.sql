-- 013: Store the personal and financial details collected during sign-up.

ALTER TABLE customers
    ADD COLUMN city VARCHAR(100) NULL AFTER address;

ALTER TABLE customers
    ADD COLUMN state_region VARCHAR(100) NULL AFTER city;

ALTER TABLE customers
    ADD COLUMN postal_code VARCHAR(10) NULL AFTER state_region;

ALTER TABLE customers
    ADD COLUMN mailing_same_as_residential BOOLEAN NOT NULL DEFAULT FALSE AFTER postal_code;

ALTER TABLE customers
    ADD COLUMN civil_status VARCHAR(20) NULL AFTER mailing_same_as_residential;

ALTER TABLE customers
    ADD COLUMN suffix VARCHAR(10) NULL AFTER civil_status;

ALTER TABLE customers
    ADD COLUMN employment_status VARCHAR(30) NULL AFTER suffix;

ALTER TABLE customers
    ADD COLUMN occupation VARCHAR(100) NULL AFTER employment_status;

ALTER TABLE customers
    ADD COLUMN employer_name VARCHAR(150) NULL AFTER occupation;

ALTER TABLE customers
    ADD COLUMN annual_gross_income DECIMAL(14, 2) NULL AFTER employer_name;

ALTER TABLE customers
    ADD COLUMN account_ownership_type VARCHAR(30) NULL AFTER annual_gross_income;
