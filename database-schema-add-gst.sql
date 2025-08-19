-- Add GST field to customer_master table
-- This script adds a GSTIN field to store customer GST numbers

-- Add GSTIN column to customer_master table
ALTER TABLE customer_master 
ADD COLUMN IF NOT EXISTS gstin TEXT;

-- Add index for GSTIN searches
CREATE INDEX IF NOT EXISTS idx_customer_master_gstin ON customer_master(gstin);

-- Update the customer code generation function to include GSTIN validation
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
DECLARE
    next_sequence INTEGER;
    new_customer_code TEXT;
BEGIN
    -- Get the next sequence number
    SELECT COALESCE(MAX(CAST(SUBSTRING(customer_master.customer_code FROM 6) AS INTEGER)), 0) + 1
    INTO next_sequence
    FROM customer_master;
    
    -- Format: CUST-XXXX (4 digits) - keep this different from document numbers
    new_customer_code := 'CUST-' || LPAD(next_sequence::TEXT, 4, '0');
    
    RETURN new_customer_code;
END;
$$ LANGUAGE plpgsql;

