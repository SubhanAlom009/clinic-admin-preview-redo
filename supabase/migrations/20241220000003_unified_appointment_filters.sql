-- Unified appointment filtering functions for consistent ACTIVE status and timezone handling
-- This migration creates SQL functions to handle appointment filtering consistently

-- Function to get active appointments for a doctor on a specific date
CREATE OR REPLACE FUNCTION get_active_appointments(
  p_clinic_doctor_id uuid,
  p_service_day date
)
RETURNS TABLE (
  id uuid,
  appointment_datetime timestamptz,
  status text,
  queue_position integer,
  estimated_start_time timestamptz,
  duration_minutes integer,
  emergency_status text,
  patient_checked_in boolean,
  checked_in_at timestamptz,
  clinic_patient_id uuid,
  clinic_doctor_id uuid,
  service_day date,
  created_at timestamptz,
  updated_at timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.appointment_datetime,
    a.status,
    a.queue_position,
    a.estimated_start_time,
    a.duration_minutes,
    a.emergency_status,
    a.patient_checked_in,
    a.checked_in_at,
    a.clinic_patient_id,
    a.clinic_doctor_id,
    a.service_day,
    a.created_at,
    a.updated_at
  FROM appointments a
  WHERE a.clinic_doctor_id = p_clinic_doctor_id
    AND a.service_day = p_service_day
    AND a.status IN ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS')
  ORDER BY 
    a.emergency_status DESC, -- Emergency appointments first
    a.queue_position ASC NULLS LAST, -- Then by queue position
    a.appointment_datetime ASC; -- Finally by appointment time
END;
$$;

-- Function to get completed appointments for a doctor on a specific date
CREATE OR REPLACE FUNCTION get_completed_appointments(
  p_clinic_doctor_id uuid,
  p_service_day date
)
RETURNS TABLE (
  id uuid,
  appointment_datetime timestamptz,
  status text,
  queue_position integer,
  estimated_start_time timestamptz,
  duration_minutes integer,
  emergency_status text,
  patient_checked_in boolean,
  checked_in_at timestamptz,
  clinic_patient_id uuid,
  clinic_doctor_id uuid,
  service_day date,
  created_at timestamptz,
  updated_at timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.appointment_datetime,
    a.status,
    a.queue_position,
    a.estimated_start_time,
    a.duration_minutes,
    a.emergency_status,
    a.patient_checked_in,
    a.checked_in_at,
    a.clinic_patient_id,
    a.clinic_doctor_id,
    a.service_day,
    a.created_at,
    a.updated_at
  FROM appointments a
  WHERE a.clinic_doctor_id = p_clinic_doctor_id
    AND a.service_day = p_service_day
    AND a.status IN ('COMPLETED', 'NO_SHOW', 'CANCELLED')
  ORDER BY 
    a.appointment_datetime DESC; -- Most recent first
END;
$$;

-- Function to get upcoming appointments for a patient (UTC-based)
CREATE OR REPLACE FUNCTION get_upcoming_appointments(
  p_clinic_patient_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  appointment_datetime timestamptz,
  status text,
  queue_position integer,
  estimated_start_time timestamptz,
  duration_minutes integer,
  emergency_status text,
  patient_checked_in boolean,
  checked_in_at timestamptz,
  clinic_patient_id uuid,
  clinic_doctor_id uuid,
  service_day date,
  created_at timestamptz,
  updated_at timestamptz,
  doctor_name text,
  doctor_specialization text,
  clinic_name text
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.appointment_datetime,
    a.status,
    a.queue_position,
    a.estimated_start_time,
    a.duration_minutes,
    a.emergency_status,
    a.patient_checked_in,
    a.checked_in_at,
    a.clinic_patient_id,
    a.clinic_doctor_id,
    a.service_day,
    a.created_at,
    a.updated_at,
    dp.full_name as doctor_name,
    dp.primary_specialization as doctor_specialization,
    cp.clinic_name
  FROM appointments a
  JOIN clinic_doctors cd ON a.clinic_doctor_id = cd.id
  JOIN doctor_profiles dp ON cd.doctor_profile_id = dp.id
  JOIN clinic_profiles cp ON cd.clinic_id = cp.id
  WHERE a.clinic_patient_id = p_clinic_patient_id
    AND a.appointment_datetime > NOW() -- UTC comparison
    AND a.status IN ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS')
  ORDER BY 
    a.appointment_datetime ASC
  LIMIT p_limit;
END;
$$;

-- Function to get past appointments for a patient (UTC-based)
CREATE OR REPLACE FUNCTION get_past_appointments(
  p_clinic_patient_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  appointment_datetime timestamptz,
  status text,
  queue_position integer,
  estimated_start_time timestamptz,
  duration_minutes integer,
  emergency_status text,
  patient_checked_in boolean,
  checked_in_at timestamptz,
  clinic_patient_id uuid,
  clinic_doctor_id uuid,
  service_day date,
  created_at timestamptz,
  updated_at timestamptz,
  doctor_name text,
  doctor_specialization text,
  clinic_name text
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.appointment_datetime,
    a.status,
    a.queue_position,
    a.estimated_start_time,
    a.duration_minutes,
    a.emergency_status,
    a.patient_checked_in,
    a.checked_in_at,
    a.clinic_patient_id,
    a.clinic_doctor_id,
    a.service_day,
    a.created_at,
    a.updated_at,
    dp.full_name as doctor_name,
    dp.primary_specialization as doctor_specialization,
    cp.clinic_name
  FROM appointments a
  JOIN clinic_doctors cd ON a.clinic_doctor_id = cd.id
  JOIN doctor_profiles dp ON cd.doctor_profile_id = dp.id
  JOIN clinic_profiles cp ON cd.clinic_id = cp.id
  WHERE a.clinic_patient_id = p_clinic_patient_id
    AND a.appointment_datetime <= NOW() -- UTC comparison
    AND a.status IN ('COMPLETED', 'NO_SHOW', 'CANCELLED')
  ORDER BY 
    a.appointment_datetime DESC
  LIMIT p_limit;
END;
$$;

-- Function to get all appointments for a patient with proper timezone handling
CREATE OR REPLACE FUNCTION get_patient_appointments(
  p_clinic_patient_id uuid,
  p_status_filter text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  appointment_datetime timestamptz,
  status text,
  queue_position integer,
  estimated_start_time timestamptz,
  duration_minutes integer,
  emergency_status text,
  patient_checked_in boolean,
  checked_in_at timestamptz,
  clinic_patient_id uuid,
  clinic_doctor_id uuid,
  service_day date,
  created_at timestamptz,
  updated_at timestamptz,
  doctor_name text,
  doctor_specialization text,
  clinic_name text,
  is_upcoming boolean,
  is_past boolean
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.appointment_datetime,
    a.status,
    a.queue_position,
    a.estimated_start_time,
    a.duration_minutes,
    a.emergency_status,
    a.patient_checked_in,
    a.checked_in_at,
    a.clinic_patient_id,
    a.clinic_doctor_id,
    a.service_day,
    a.created_at,
    a.updated_at,
    dp.full_name as doctor_name,
    dp.primary_specialization as doctor_specialization,
    cp.clinic_name,
    (a.appointment_datetime > NOW()) as is_upcoming,
    (a.appointment_datetime <= NOW()) as is_past
  FROM appointments a
  JOIN clinic_doctors cd ON a.clinic_doctor_id = cd.id
  JOIN doctor_profiles dp ON cd.doctor_profile_id = dp.id
  JOIN clinic_profiles cp ON cd.clinic_id = cp.id
  WHERE a.clinic_patient_id = p_clinic_patient_id
    AND (p_status_filter IS NULL OR a.status = p_status_filter)
  ORDER BY 
    a.appointment_datetime DESC
  LIMIT p_limit;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor_service_day_status 
ON appointments(clinic_doctor_id, service_day, status);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_patient_datetime_status 
ON appointments(clinic_patient_id, appointment_datetime, status);

CREATE INDEX IF NOT EXISTS idx_appointments_datetime_status 
ON appointments(appointment_datetime, status);

-- Add comments for documentation
COMMENT ON FUNCTION get_active_appointments IS 'Returns active appointments (SCHEDULED, CHECKED_IN, IN_PROGRESS) for a doctor on a specific date, ordered by emergency status, queue position, and appointment time';
COMMENT ON FUNCTION get_completed_appointments IS 'Returns completed appointments (COMPLETED, NO_SHOW, CANCELLED) for a doctor on a specific date, ordered by appointment time (most recent first)';
COMMENT ON FUNCTION get_upcoming_appointments IS 'Returns upcoming appointments for a patient using UTC time comparison, includes doctor and clinic details';
COMMENT ON FUNCTION get_past_appointments IS 'Returns past appointments for a patient using UTC time comparison, includes doctor and clinic details';
COMMENT ON FUNCTION get_patient_appointments IS 'Returns all appointments for a patient with optional status filter, includes timezone-aware upcoming/past flags';
