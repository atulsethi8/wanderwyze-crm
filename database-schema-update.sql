-- Safe Update Script for Customer Management and Billing System
-- This script only adds missing elements without dropping existing data
-- Safe to run multiple times

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add missing columns to customer_master if they don't exist
DO $$ 
BEGIN
    -- Add email column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_master' AND column_name = 'email') THEN
        ALTER TABLE customer_master ADD COLUMN email TEXT;
    END IF;
    
    -- Add phone column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_master' AND column_name = 'phone') THEN
        ALTER TABLE customer_master ADD COLUMN phone TEXT;
    END IF;
    
    -- Add address column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_master' AND column_name = 'address') THEN
        ALTER TABLE customer_master ADD COLUMN address TEXT;
    END IF;
    
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_master' AND column_name = 'created_at') THEN
        ALTER TABLE customer_master ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Add missing columns to invoice if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice') THEN
        -- Add billing_address column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'invoice' AND column_name = 'billing_address') THEN
            ALTER TABLE invoice ADD COLUMN billing_address TEXT;
        END IF;
        
        -- Add created_at column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'invoice' AND column_name = 'created_at') THEN
            ALTER TABLE invoice ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_customer_master_customer_code ON customer_master(customer_code);
CREATE INDEX IF NOT EXISTS idx_customer_master_name ON customer_master(name);

-- Create invoice indexes if invoice table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice') THEN
        CREATE INDEX IF NOT EXISTS idx_invoice_customer_id ON invoice(customer_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_invoice_number ON invoice(invoice_number);
    END IF;
END $$;

-- Function to generate customer code (will replace if exists)
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
DECLARE
    next_sequence INTEGER;
    customer_code TEXT;
BEGIN
    -- Get the next sequence number
    SELECT COALESCE(MAX(CAST(SUBSTRING(customer_code FROM 6) AS INTEGER)), 0) + 1
    INTO next_sequence
    FROM customer_master;
    
    -- Format: CUST-XXXX (4 digits)
    customer_code := 'CUST-' || LPAD(next_sequence::TEXT, 4, '0');
    
    RETURN customer_code;
END;
$$ LANGUAGE plpgsql;

-- Function to generate invoice number (will replace if exists)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    next_sequence INTEGER;
    invoice_number TEXT;
BEGIN
    -- Get the next sequence number
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_sequence
    FROM invoice;
    
    -- Format: INV-XXXX (4 digits)
    invoice_number := 'INV-' || LPAD(next_sequence::TEXT, 4, '0');
    
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on customer_master if not already enabled
ALTER TABLE customer_master ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON customer_master;

-- Policy for customer_master (allow all operations for authenticated users)
CREATE POLICY "Allow all operations for authenticated users" ON customer_master
    FOR ALL USING (auth.role() = 'authenticated');

-- Enable RLS on invoice if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice') THEN
        ALTER TABLE invoice ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON invoice;
        
        -- Policy for invoice (allow all operations for authenticated users)
        CREATE POLICY "Allow all operations for authenticated users" ON invoice
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

