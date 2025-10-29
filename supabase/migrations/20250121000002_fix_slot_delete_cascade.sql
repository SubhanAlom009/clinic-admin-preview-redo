-- Migration: Fix Foreign Key Constraint for Slot Deletion
-- This migration adds ON DELETE CASCADE to the appointments_doctor_slot_id_fkey constraint

-- Drop the existing constraint
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_doctor_slot_id_fkey;

-- Recreate the constraint with ON DELETE CASCADE
ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_doctor_slot_id_fkey 
  FOREIGN KEY (doctor_slot_id) REFERENCES public.doctor_slots(id) ON DELETE CASCADE;

-- Add comment for documentation
COMMENT ON CONSTRAINT appointments_doctor_slot_id_fkey ON public.appointments IS 
  'Foreign key constraint with CASCADE delete - when a doctor slot is deleted, associated appointments are also deleted';
