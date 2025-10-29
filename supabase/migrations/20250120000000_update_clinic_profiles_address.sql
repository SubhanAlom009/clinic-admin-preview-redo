-- Update clinic_profiles address field
-- Remove old address text field and add primary_address JSONB field

-- Check if address column exists and drop it
ALTER TABLE clinic_profiles DROP COLUMN IF EXISTS address;

-- Add primary_address JSONB column to clinic_profiles
ALTER TABLE clinic_profiles 
  ADD COLUMN IF NOT EXISTS primary_address JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN clinic_profiles.primary_address IS 'Structured address with fields: address_line1, address_line2, street, area, city, state, postal_code, country';
