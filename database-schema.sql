-- Customer Management and Billing System Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customer Master Table
CREATE TABLE customer_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice Table
CREATE TABLE invoice (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customer_master(id) ON DELETE CASCADE,
    billing_address TEXT,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_customer_master_customer_code ON customer_master(customer_code);
CREATE INDEX idx_customer_master_name ON customer_master(name);
CREATE INDEX idx_invoice_customer_id ON invoice(customer_id);
CREATE INDEX idx_invoice_invoice_number ON invoice(invoice_number);

-- Function to generate customer code
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

-- Function to generate invoice number
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

-- Row Level Security (RLS) policies
ALTER TABLE customer_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice ENABLE ROW LEVEL SECURITY;

-- Policy for customer_master (allow all operations for authenticated users)
CREATE POLICY "Allow all operations for authenticated users" ON customer_master
    FOR ALL USING (auth.role() = 'authenticated');

-- Policy for invoice (allow all operations for authenticated users)
CREATE POLICY "Allow all operations for authenticated users" ON invoice
    FOR ALL USING (auth.role() = 'authenticated');
