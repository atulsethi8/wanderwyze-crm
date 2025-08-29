-- Fix Leads Table with Dependent View
-- This script handles the view dependency and fixes the column mismatch

DO $$
DECLARE
    has_lead_name BOOLEAN;
    has_name BOOLEAN;
    view_exists BOOLEAN;
BEGIN
    -- Check what columns exist
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'lead_name') INTO has_lead_name;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'name') INTO has_name;
    SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'leads_complete') INTO view_exists;
    
    RAISE NOTICE '=== FIXING LEADS TABLE WITH VIEW DEPENDENCY ===';
    RAISE NOTICE 'Has lead_name column: %', has_lead_name;
    RAISE NOTICE 'Has name column: %', has_name;
    RAISE NOTICE 'leads_complete view exists: %', view_exists;
    
    -- Drop the view first if it exists
    IF view_exists THEN
        RAISE NOTICE 'Dropping leads_complete view...';
        DROP VIEW IF EXISTS leads_complete;
        RAISE NOTICE '✅ Successfully dropped leads_complete view';
    END IF;
    
    -- Now drop the old lead_name column
    IF has_lead_name AND has_name THEN
        RAISE NOTICE 'Dropping old lead_name column...';
        ALTER TABLE leads DROP COLUMN lead_name;
        RAISE NOTICE '✅ Successfully dropped lead_name column';
    ELSIF has_lead_name AND NOT has_name THEN
        RAISE NOTICE 'Renaming lead_name to name...';
        ALTER TABLE leads RENAME COLUMN lead_name TO name;
        RAISE NOTICE '✅ Successfully renamed lead_name to name';
    ELSE
        RAISE NOTICE 'No action needed - schema is already correct';
    END IF;
    
    RAISE NOTICE 'Column fix completed!';
END $$;

-- Recreate the leads_complete view with correct schema
CREATE OR REPLACE VIEW leads_complete AS
SELECT 
    l.*,
    COALESCE(q.flights, 0) as quotation_flights,
    COALESCE(q.hotels, 0) as quotation_hotels,
    COALESCE(q.excursions, 0) as quotation_excursions,
    COALESCE(q.transfers, 0) as quotation_transfers,
    COALESCE(q.total, 0) as quotation_total,
    jsonb_object_agg(
        'day' || li.day_number, 
        li.itinerary_text
    ) FILTER (WHERE li.itinerary_text IS NOT NULL) as itinerary
FROM leads l
LEFT JOIN lead_quotation q ON l.id = q.lead_id
LEFT JOIN lead_itinerary li ON l.id = li.lead_id
GROUP BY l.id, q.flights, q.hotels, q.excursions, q.transfers, q.total;

-- Verify the final schema
DO $$
DECLARE
    col_record RECORD;
BEGIN
    RAISE NOTICE '=== FINAL SCHEMA VERIFICATION ===';
    RAISE NOTICE 'Current leads table columns:';
    
    FOR col_record IN 
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'leads' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  %: % (nullable: %)', 
            col_record.column_name, 
            col_record.data_type, 
            col_record.is_nullable;
    END LOOP;
    
    RAISE NOTICE '✅ leads_complete view recreated successfully';
END $$;
