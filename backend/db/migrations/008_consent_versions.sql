-- 008: Record the consent document version and the optional AI Insights consent.

ALTER TABLE customers
    ADD COLUMN consent_version VARCHAR(64) NULL AFTER privacy_accepted_at;

ALTER TABLE customers
    ADD COLUMN ai_insights_consent BOOLEAN NOT NULL DEFAULT FALSE AFTER consent_version;

ALTER TABLE customers
    ADD COLUMN ai_insights_consent_at DATETIME NULL AFTER ai_insights_consent;
