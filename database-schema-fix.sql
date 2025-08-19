-- Fix for ambiguous column reference in database functions
-- Run this to fix the generate_customer_code and generate_invoice_number functions

-- Function to generate customer code (fixed version)
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
    
    -- Format: CUST-XXXX (4 digits)
    new_customer_code := 'CUST-' || LPAD(next_sequence::TEXT, 4, '0');
    
    RETURN new_customer_code;
END;
$$ LANGUAGE plpgsql;

-- Function to generate invoice number (fixed version)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    next_sequence INTEGER;
    new_invoice_number TEXT;
BEGIN
    -- Get the next sequence number
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice.invoice_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_sequence
    FROM invoice;
    
    -- Format: INV-XXXX (4 digits)
    new_invoice_number := 'INV-' || LPAD(next_sequence::TEXT, 4, '0');
    
    RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;

