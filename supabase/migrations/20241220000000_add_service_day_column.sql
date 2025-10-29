-- Add service_day column to appointments table
-- This column is needed for queue management and filtering

-- Add service_day column to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS service_day date;

-- Create index for service_day column
CREATE INDEX IF NOT EXISTS idx_appointments_service_day 
ON appointments(service_day);

-- Update existing appointments to populate service_day from appointment_datetime
UPDATE appointments 
SET service_day = DATE(appointment_datetime AT TIME ZONE 'UTC')
WHERE service_day IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN appointments.service_day IS 'Service day for the appointment (derived from appointment_datetime) for queue management';
