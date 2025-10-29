-- Migration: Fix appointment_requests foreign key constraint to allow appointment deletion
-- This fixes the issue where appointments cannot be deleted due to appointment_requests references

-- Drop the existing foreign key constraint that lacks ON DELETE behavior
ALTER TABLE appointment_requests 
DROP CONSTRAINT IF EXISTS appointment_requests_appointment_id_fkey;

-- Recreate the foreign key constraint with CASCADE delete behavior
-- When an appointment is deleted, related appointment_requests will also be deleted
ALTER TABLE appointment_requests 
ADD CONSTRAINT appointment_requests_appointment_id_fkey 
FOREIGN KEY (appointment_id) 
REFERENCES appointments (id) 
ON DELETE CASCADE;

-- Add comment to document the behavior
COMMENT ON CONSTRAINT appointment_requests_appointment_id_fkey ON appointment_requests 
IS 'Foreign key to appointments table with CASCADE delete - when appointment is deleted, related requests are also deleted';

-- Verify the constraint was created correctly
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'appointment_requests'
    AND kcu.column_name = 'appointment_id';