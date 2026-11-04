-- 009: Remove the retired AI Insights consent columns.

ALTER TABLE customers
    DROP COLUMN ai_insights_consent;

ALTER TABLE customers
    DROP COLUMN ai_insights_consent_at;
