-- 014: Reference numbers for customer transaction requests.

ALTER TABLE transaction_requests
    ADD COLUMN reference_code VARCHAR(40) NOT NULL DEFAULT '' AFTER request_id;

UPDATE transaction_requests
SET reference_code = CONCAT('REQ-', LPAD(request_id, 8, '0'))
WHERE reference_code = '';

CREATE UNIQUE INDEX idx_tx_requests_reference
    ON transaction_requests(reference_code);
