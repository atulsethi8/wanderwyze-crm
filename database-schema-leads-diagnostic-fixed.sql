-- Diagnostic Script for Leads Pipeline (Fixed)
-- This script will check the current state of your database and identify any conflicts

-- Check if leads table exists and show its structure
DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
    col_record RECORD;
BEGIN
    -- Check if leads table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'leads' AND table_schema = 'public'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ leads table EXISTS';
        
        -- Count columns
        SELECT COUNT(*) INTO column_count 
        FROM information_schema.columns 
        WHERE table_name = 'leads' AND table_schema = 'public';
        
        RAISE NOTICE '📊 leads table has % columns', column_count;
        
        -- Show all columns in leads table
        RAISE NOTICE '📋 Current columns in leads table:';
        FOR col_record IN 
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'leads' AND table_schema = 'public'
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '   - % (%): %', col_record.column_name, col_record.data_type, 
                CASE WHEN col_record.is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END;
        END LOOP;
        
        -- Check for specific columns we need
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'status') THEN
            RAISE NOTICE '✅ status column EXISTS';
        ELSE
            RAISE NOTICE '❌ status column MISSING';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'travel_dates') THEN
            RAISE NOTICE '✅ travel_dates column EXISTS';
        ELSE
            RAISE NOTICE '❌ travel_dates column MISSING';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'number_of_pax') THEN
            RAISE NOTICE '✅ number_of_pax column EXISTS';
        ELSE
            RAISE NOTICE '❌ number_of_pax column MISSING';
        END IF;
        
    ELSE
        RAISE NOTICE '❌ leads table DOES NOT EXIST';
    END IF;
END $$;

-- Check for other leads-related tables
DO $$
DECLARE
    itinerary_exists BOOLEAN;
    quotation_exists BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_name = 'lead_itinerary' AND table_schema = 'public') INTO itinerary_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_name = 'lead_quotation' AND table_schema = 'public') INTO quotation_exists;
    
    RAISE NOTICE '📋 Other leads-related tables:';
    RAISE NOTICE '   lead_itinerary: %', CASE WHEN itinerary_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '   lead_quotation: %', CASE WHEN quotation_exists THEN 'EXISTS' ELSE 'MISSING' END;
END $$;

-- Check for any existing data
DO $$
DECLARE
    leads_count INTEGER;
    itinerary_count INTEGER;
    quotation_count INTEGER;
BEGIN
    -- Check if leads table exists before counting
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'leads' AND table_schema = 'public') THEN
        SELECT COUNT(*) INTO leads_count FROM leads;
        RAISE NOTICE '📊 Current data: % leads', leads_count;
    ELSE
        RAISE NOTICE '📊 Current data: leads table does not exist';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'lead_itinerary' AND table_schema = 'public') THEN
        SELECT COUNT(*) INTO itinerary_count FROM lead_itinerary;
        RAISE NOTICE '📊 Current data: % itinerary records', itinerary_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'lead_quotation' AND table_schema = 'public') THEN
        SELECT COUNT(*) INTO quotation_count FROM lead_quotation;
        RAISE NOTICE '📊 Current data: % quotation records', quotation_count;
    END IF;
END $$;

-- Show any existing constraints or indexes (only if leads table exists)
DO $$
DECLARE
    table_exists BOOLEAN;
    constraint_record RECORD;
    index_record RECORD;
BEGIN
    -- Check if leads table exists
    SELECT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_name = 'leads' AND table_schema = 'public') INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '🔍 Checking for existing constraints and indexes...';
        
        -- Check constraints
        FOR constraint_record IN 
            SELECT conname, contype, pg_get_constraintdef(oid) as definition
            FROM pg_constraint 
            WHERE conrelid = 'leads'::regclass
        LOOP
            RAISE NOTICE '   Constraint: % (%): %', constraint_record.conname, constraint_record.contype, constraint_record.definition;
        END LOOP;
        
        -- Check indexes
        FOR index_record IN 
            SELECT indexname, indexdef
            FROM pg_indexes 
            WHERE tablename = 'leads'
        LOOP
            RAISE NOTICE '   Index: %: %', index_record.indexname, index_record.indexdef;
        END LOOP;
    ELSE
        RAISE NOTICE '🔍 No leads table exists - skipping constraints and indexes check';
    END IF;
END $$;
