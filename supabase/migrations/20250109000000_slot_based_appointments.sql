-- Migration: Slot-Based Appointment Booking System
-- This migration creates the foundation for slot-based appointments

-- Create doctor_slots table
CREATE TABLE public.doctor_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_doctor_id uuid NOT NULL,
  slot_date date NOT NULL,
  slot_name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_capacity integer NOT NULL DEFAULT 10,
  current_bookings integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT doctor_slots_pkey PRIMARY KEY (id),
  CONSTRAINT doctor_slots_clinic_doctor_id_fkey 
    FOREIGN KEY (clinic_doctor_id) REFERENCES public.clinic_doctors(id) ON DELETE CASCADE,
  CONSTRAINT doctor_slots_capacity_check 
    CHECK (max_capacity > 0 AND max_capacity <= 50),
  CONSTRAINT doctor_slots_time_check 
    CHECK (end_time > start_time),
  CONSTRAINT doctor_slots_current_bookings_check 
    CHECK (current_bookings >= 0 AND current_bookings <= max_capacity),
  UNIQUE(clinic_doctor_id, slot_date, slot_name)
);

-- Create slot_bookings table
CREATE TABLE public.slot_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  doctor_slot_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  booking_order integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT slot_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT slot_bookings_doctor_slot_id_fkey 
    FOREIGN KEY (doctor_slot_id) REFERENCES public.doctor_slots(id) ON DELETE CASCADE,
  CONSTRAINT slot_bookings_appointment_id_fkey 
    FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE,
  CONSTRAINT slot_bookings_booking_order_check 
    CHECK (booking_order > 0),
  UNIQUE(doctor_slot_id, appointment_id)
);

-- Add slot-related columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN doctor_slot_id uuid,
ADD COLUMN slot_booking_order integer,
ADD CONSTRAINT appointments_doctor_slot_id_fkey 
  FOREIGN KEY (doctor_slot_id) REFERENCES public.doctor_slots(id);

-- Add slot management columns to clinic_doctors table
ALTER TABLE public.clinic_doctors 
ADD COLUMN default_slot_duration integer DEFAULT 180,
ADD COLUMN max_patients_per_slot integer DEFAULT 10,
ADD COLUMN slot_creation_enabled boolean DEFAULT true,
ADD CONSTRAINT clinic_doctors_default_slot_duration_check 
  CHECK (default_slot_duration >= 60 AND default_slot_duration <= 480),
ADD CONSTRAINT clinic_doctors_max_patients_per_slot_check 
  CHECK (max_patients_per_slot >= 1 AND max_patients_per_slot <= 50);

-- Create indexes for performance
CREATE INDEX idx_doctor_slots_clinic_doctor_date ON public.doctor_slots(clinic_doctor_id, slot_date);
CREATE INDEX idx_doctor_slots_active ON public.doctor_slots(is_active) WHERE is_active = true;
CREATE INDEX idx_doctor_slots_date_active ON public.doctor_slots(slot_date, is_active) WHERE is_active = true;
CREATE INDEX idx_slot_bookings_slot_id ON public.slot_bookings(doctor_slot_id);
CREATE INDEX idx_slot_bookings_appointment_id ON public.slot_bookings(appointment_id);
CREATE INDEX idx_slot_bookings_order ON public.slot_bookings(doctor_slot_id, booking_order);
CREATE INDEX idx_appointments_doctor_slot_id ON public.appointments(doctor_slot_id);

-- Create function to update slot booking count
CREATE OR REPLACE FUNCTION update_slot_booking_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.doctor_slots 
    SET current_bookings = current_bookings + 1,
        updated_at = now()
    WHERE id = NEW.doctor_slot_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.doctor_slots 
    SET current_bookings = current_bookings - 1,
        updated_at = now()
    WHERE id = OLD.doctor_slot_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update slot booking count
CREATE TRIGGER trigger_update_slot_booking_count
  AFTER INSERT OR DELETE ON public.slot_bookings
  FOR EACH ROW EXECUTE FUNCTION update_slot_booking_count();

-- Create function to validate slot capacity before booking
CREATE OR REPLACE FUNCTION validate_slot_capacity()
RETURNS TRIGGER AS $$
DECLARE
  slot_capacity integer;
  current_count integer;
BEGIN
  SELECT max_capacity, current_bookings 
  INTO slot_capacity, current_count
  FROM public.doctor_slots 
  WHERE id = NEW.doctor_slot_id;
  
  IF current_count >= slot_capacity THEN
    RAISE EXCEPTION 'Slot is at maximum capacity (%)', slot_capacity;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate slot capacity
CREATE TRIGGER trigger_validate_slot_capacity
  BEFORE INSERT ON public.slot_bookings
  FOR EACH ROW EXECUTE FUNCTION validate_slot_capacity();

-- Create function to assign booking order
CREATE OR REPLACE FUNCTION assign_booking_order()
RETURNS TRIGGER AS $$
DECLARE
  next_order integer;
BEGIN
  SELECT COALESCE(MAX(booking_order), 0) + 1 
  INTO next_order
  FROM public.slot_bookings 
  WHERE doctor_slot_id = NEW.doctor_slot_id;
  
  NEW.booking_order = next_order;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to assign booking order
CREATE TRIGGER trigger_assign_booking_order
  BEFORE INSERT ON public.slot_bookings
  FOR EACH ROW EXECUTE FUNCTION assign_booking_order();

-- Enable RLS on new tables
ALTER TABLE public.doctor_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_bookings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for doctor_slots
CREATE POLICY "Users can view slots for their clinic doctors" ON public.doctor_slots
  FOR SELECT USING (
    clinic_doctor_id IN (
      SELECT id FROM public.clinic_doctors 
      WHERE clinic_id = auth.uid()
    )
  );

CREATE POLICY "Users can create slots for their clinic doctors" ON public.doctor_slots
  FOR INSERT WITH CHECK (
    clinic_doctor_id IN (
      SELECT id FROM public.clinic_doctors 
      WHERE clinic_id = auth.uid()
    )
  );

CREATE POLICY "Users can update slots for their clinic doctors" ON public.doctor_slots
  FOR UPDATE USING (
    clinic_doctor_id IN (
      SELECT id FROM public.clinic_doctors 
      WHERE clinic_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete slots for their clinic doctors" ON public.doctor_slots
  FOR DELETE USING (
    clinic_doctor_id IN (
      SELECT id FROM public.clinic_doctors 
      WHERE clinic_id = auth.uid()
    )
  );

-- Create RLS policies for slot_bookings
CREATE POLICY "Users can view slot bookings for their clinic" ON public.slot_bookings
  FOR SELECT USING (
    doctor_slot_id IN (
      SELECT ds.id FROM public.doctor_slots ds
      JOIN public.clinic_doctors cd ON ds.clinic_doctor_id = cd.id
      WHERE cd.clinic_id = auth.uid()
    )
  );

CREATE POLICY "Users can create slot bookings for their clinic" ON public.slot_bookings
  FOR INSERT WITH CHECK (
    doctor_slot_id IN (
      SELECT ds.id FROM public.doctor_slots ds
      JOIN public.clinic_doctors cd ON ds.clinic_doctor_id = cd.id
      WHERE cd.clinic_id = auth.uid()
    )
  );

CREATE POLICY "Users can update slot bookings for their clinic" ON public.slot_bookings
  FOR UPDATE USING (
    doctor_slot_id IN (
      SELECT ds.id FROM public.doctor_slots ds
      JOIN public.clinic_doctors cd ON ds.clinic_doctor_id = cd.id
      WHERE cd.clinic_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete slot bookings for their clinic" ON public.slot_bookings
  FOR DELETE USING (
    doctor_slot_id IN (
      SELECT ds.id FROM public.doctor_slots ds
      JOIN public.clinic_doctors cd ON ds.clinic_doctor_id = cd.id
      WHERE cd.clinic_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.doctor_slots IS 'Time slots created by clinic admins for doctors';
COMMENT ON TABLE public.slot_bookings IS 'Appointments booked within specific time slots';
COMMENT ON COLUMN public.doctor_slots.slot_name IS 'Human-readable name like "Morning Slot" or "Afternoon Slot"';
COMMENT ON COLUMN public.doctor_slots.max_capacity IS 'Maximum number of patients that can be booked in this slot';
COMMENT ON COLUMN public.doctor_slots.current_bookings IS 'Current number of patients booked in this slot (auto-updated)';
COMMENT ON COLUMN public.slot_bookings.booking_order IS 'Order of appointment within the slot (1st, 2nd, etc.)';
COMMENT ON COLUMN public.appointments.doctor_slot_id IS 'Reference to the time slot this appointment belongs to';
COMMENT ON COLUMN public.appointments.slot_booking_order IS 'Position in the slot queue (duplicated for performance)';
COMMENT ON COLUMN public.clinic_doctors.default_slot_duration IS 'Default duration in minutes for slots (120, 180, 240)';
COMMENT ON COLUMN public.clinic_doctors.max_patients_per_slot IS 'Default maximum patients per slot';
COMMENT ON COLUMN public.clinic_doctors.slot_creation_enabled IS 'Whether this doctor can have slots created';
