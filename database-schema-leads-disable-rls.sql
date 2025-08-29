-- Disable RLS for Leads Pipeline (Temporary)
-- This script disables Row Level Security to allow leads functionality to work

-- Disable RLS on leads tables
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_itinerary DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_quotation DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON leads;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON lead_itinerary;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON lead_quotation;

-- Create simple policies that allow all operations (for development)
CREATE POLICY "Allow all operations" ON leads
    FOR ALL USING (true);

CREATE POLICY "Allow all operations" ON lead_itinerary
    FOR ALL USING (true);

CREATE POLICY "Allow all operations" ON lead_quotation
    FOR ALL USING (true);

-- Verify the changes
DO $$
DECLARE
    leads_rls_enabled BOOLEAN;
    itinerary_rls_enabled BOOLEAN;
    quotation_rls_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO leads_rls_enabled FROM pg_class WHERE relname = 'leads';
    SELECT relrowsecurity INTO itinerary_rls_enabled FROM pg_class WHERE relname = 'lead_itinerary';
    SELECT relrowsecurity INTO quotation_rls_enabled FROM pg_class WHERE relname = 'lead_quotation';
    
    RAISE NOTICE '=== RLS STATUS ===';
    RAISE NOTICE 'leads table RLS: %', CASE WHEN leads_rls_enabled THEN 'ENABLED' ELSE 'DISABLED' END;
    RAISE NOTICE 'lead_itinerary table RLS: %', CASE WHEN itinerary_rls_enabled THEN 'ENABLED' ELSE 'DISABLED' END;
    RAISE NOTICE 'lead_quotation table RLS: %', CASE WHEN quotation_rls_enabled THEN 'ENABLED' ELSE 'DISABLED' END;
    RAISE NOTICE 'RLS has been disabled for development. Leads should now work!';
END $$;
