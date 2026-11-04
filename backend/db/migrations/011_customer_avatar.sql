-- 011: Store a customer-uploaded avatar as a data URL.

ALTER TABLE customers
    ADD COLUMN avatar MEDIUMTEXT NULL AFTER address;
