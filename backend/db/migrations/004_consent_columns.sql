-- 004: Record when users accepted the Terms of Agreement and Privacy Notice.
-- Applied automatically by dev.py (skipped if the columns already exist).

ALTER TABLE customers
    ADD COLUMN terms_accepted_at DATETIME NULL AFTER status;

ALTER TABLE customers
    ADD COLUMN privacy_accepted_at DATETIME NULL AFTER terms_accepted_at;
