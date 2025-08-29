-- Add number_of_nights column to leads table
-- This script adds the number_of_nights column for tracking travel duration

DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Check if number_of_nights column already exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'number_of_nights'
    ) INTO column_exists;

    RAISE NOTICE '=== ADDING number_of_nights COLUMN ===';
    RAISE NOTICE 'number_of_nights column exists: %', column_exists;

    IF NOT column_exists THEN
        -- Add the number_of_nights column
        ALTER TABLE leads ADD COLUMN number_of_nights INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Successfully added number_of_nights column';

        -- Update existing records to calculate nights based on travel dates
        UPDATE leads
        SET number_of_nights = CASE
            WHEN travel_dates->>'departureDate' IS NOT NULL
            AND travel_dates->>'returnDate' IS NOT NULL
            AND travel_dates->>'departureDate' != ''
            AND travel_dates->>'returnDate' != ''
            THEN GREATEST(0,
                (travel_dates->>'returnDate')::date - (travel_dates->>'departureDate')::date
            )
            ELSE 0
        END;
        RAISE NOTICE '✅ Updated existing records with calculated nights';

    ELSE
        RAISE NOTICE 'number_of_nights column already exists - no action needed';
    END IF;

    RAISE NOTICE 'number_of_nights column setup completed!';
END $$;

-- Verify the changes
DO $$
DECLARE
    col_record RECORD;
BEGIN
    RAISE NOTICE '=== VERIFICATION ===';
    RAISE NOTICE 'Current leads table columns:';

    FOR col_record IN
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'leads'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  %: % (nullable: %, default: %)',
            col_record.column_name,
            col_record.data_type,
            col_record.is_nullable,
            col_record.column_default;
    END LOOP;
END $$;
