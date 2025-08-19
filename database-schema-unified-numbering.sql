-- Unified Numbering System for Dockets and Invoices
-- This modifies the invoice system to use the same 5-digit format as dockets

-- 1. Create a unified sequence for both dockets and invoices
CREATE SEQUENCE IF NOT EXISTS public.unified_document_seq
  AS BIGINT
  START WITH 105  -- Start from where your docket sequence is
  INCREMENT BY 1
  CACHE 1;

-- 2. Bump the unified sequence to the maximum of existing docket_no and invoice_number
SELECT setval(
  'public.unified_document_seq',
  GREATEST(
    COALESCE((SELECT MAX(docket_no::int) FROM public.dockets WHERE docket_no ~ '^[0-9]{5}$'), 104),
    COALESCE((SELECT MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)) FROM public.invoice WHERE invoice_number ~ '^[0-9]{5}$'), 104),
    104
  ),
  TRUE
);

-- 3. Update the invoice table to use 5-digit numbers instead of INV-XXXX format
-- First, let's check if we need to update existing invoice numbers
DO $$
DECLARE
    inv RECORD;
    new_number TEXT;
BEGIN
    -- Update existing invoices to use 5-digit format
    FOR inv IN SELECT id, invoice_number FROM public.invoice WHERE invoice_number LIKE 'INV-%' LOOP
        -- Extract the number from INV-XXXX and convert to 5-digit
        new_number := LPAD(SUBSTRING(inv.invoice_number FROM 5)::TEXT, 5, '0');
        
        -- Update the invoice number
        UPDATE public.invoice SET invoice_number = new_number WHERE id = inv.id;
    END LOOP;
END $$;

-- 4. Create a unified function to generate document numbers
CREATE OR REPLACE FUNCTION generate_unified_document_number()
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    document_number TEXT;
BEGIN
    -- Get the next number from the unified sequence
    next_number := nextval('public.unified_document_seq');
    
    -- Format: 5-digit number (same as docket_no)
    document_number := LPAD(next_number::TEXT, 5, '0');
    
    RETURN document_number;
END;
$$ LANGUAGE plpgsql;

-- 5. Update the invoice number generation function to use unified numbering
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
    -- Use the unified document number generator
    RETURN generate_unified_document_number();
END;
$$ LANGUAGE plpgsql;

-- 6. Update the docket number assignment function to use unified numbering
CREATE OR REPLACE FUNCTION public.assign_docket_no()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.docket_no IS NULL OR LENGTH(TRIM(NEW.docket_no)) = 0 THEN
    -- Use the unified document number generator
    NEW.docket_no := generate_unified_document_number();
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Add a unique constraint to ensure no duplicate numbers across dockets and invoices
-- First, create a function to check for duplicates
CREATE OR REPLACE FUNCTION check_unified_number_unique()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if the number already exists in dockets
    IF EXISTS (SELECT 1 FROM public.dockets WHERE docket_no = NEW.invoice_number) THEN
        RAISE EXCEPTION 'Document number % already exists in dockets table', NEW.invoice_number;
    END IF;
    
    -- Check if the number already exists in invoices (excluding current record for updates)
    IF EXISTS (SELECT 1 FROM public.invoice WHERE invoice_number = NEW.invoice_number AND id != NEW.id) THEN
        RAISE EXCEPTION 'Document number % already exists in invoices table', NEW.invoice_number;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 8. Create trigger to enforce unique numbers across both tables
DROP TRIGGER IF EXISTS trg_check_unified_number ON public.invoice;
CREATE TRIGGER trg_check_unified_number
    BEFORE INSERT OR UPDATE ON public.invoice
    FOR EACH ROW
    EXECUTE FUNCTION check_unified_number_unique();

-- 9. Update the customer code generation to use a different format to avoid confusion
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

