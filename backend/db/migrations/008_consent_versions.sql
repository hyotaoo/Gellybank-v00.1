-- 008: Record the consent document version and the optional AI Insights consent.

ALTER TABLE customers
    ADD COLUMN consent_version VARCHAR(64) NULL AFTER privacy_accepted_at;
