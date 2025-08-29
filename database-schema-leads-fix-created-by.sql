-- Fix created_by_id Column Issue
-- This script handles the created_by_id column that's causing the null constraint error

DO $$
DECLARE
    has_created_by_id BOOLEAN;
    created_by_id_nullable BOOLEAN;
    created_by_id_type TEXT;
BEGIN
    -- Check if created_by_id column exists
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'created_by_id') INTO has_created_by_id;
    
    RAISE NOTICE '=== FIXING created_by_id COLUMN ===';
    RAISE NOTICE 'Has created_by_id column: %', has_created_by_id;
    
    IF has_created_by_id THEN
        -- Check the data type of created_by_id
        SELECT data_type INTO created_by_id_type 
        FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'created_by_id';
        
        RAISE NOTICE 'created_by_id data type: %', created_by_id_type;
        
        -- Check if created_by_id is nullable
        SELECT is_nullable = 'YES' INTO created_by_id_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'created_by_id';
        
        RAISE NOTICE 'created_by_id is nullable: %', created_by_id_nullable;
        
        IF NOT created_by_id_nullable THEN
            -- Make created_by_id nullable since we don't have user authentication yet
            RAISE NOTICE 'Making created_by_id column nullable...';
            ALTER TABLE leads ALTER COLUMN created_by_id DROP NOT NULL;
            RAISE NOTICE '✅ Successfully made created_by_id nullable';
        END IF;
        
        -- Set a default value for existing records if needed
        -- For UUID type, we'll use a proper UUID or leave as NULL
        IF created_by_id_type = 'uuid' THEN
            RAISE NOTICE 'created_by_id is UUID type - setting to NULL for existing records...';
            UPDATE leads SET created_by_id = NULL WHERE created_by_id IS NULL;
            RAISE NOTICE '✅ Set NULL for existing records (UUID type)';
        ELSE
            RAISE NOTICE 'Setting default value for created_by_id...';
            UPDATE leads SET created_by_id = 'system' WHERE created_by_id IS NULL;
            RAISE NOTICE '✅ Set default value for existing records';
        END IF;
        
    ELSE
        RAISE NOTICE 'created_by_id column does not exist - no action needed';
    END IF;
    
    RAISE NOTICE 'created_by_id fix completed!';
END $$;

-- Verify the fix
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
END $$;
