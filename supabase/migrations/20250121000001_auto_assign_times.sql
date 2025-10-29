-- Add auto-assignment columns to appointment_requests table
-- This enables automatic time assignment based on request order within slots

ALTER TABLE public.appointment_requests 
ADD COLUMN assigned_appointment_time timestamp with time zone,
ADD COLUMN request_order integer DEFAULT 0;

-- Add index for efficient querying by slot and order
CREATE INDEX idx_appointment_requests_slot_order 
ON public.appointment_requests(doctor_slot_id, request_order) 
WHERE status = 'pending';

-- Add comment explaining the new columns
COMMENT ON COLUMN public.appointment_requests.assigned_appointment_time IS 'Auto-calculated appointment time based on slot start time + (request_order * 40 minutes)';
COMMENT ON COLUMN public.appointment_requests.request_order IS 'Sequential order within the slot (0-based), determines appointment time';
