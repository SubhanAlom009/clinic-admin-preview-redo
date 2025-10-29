-- Fix Queue Management Triggers
-- This migration fixes the queue position auto-update triggers
-- Original migration used wrong column names (doctor_id vs clinic_doctor_id)

-- Drop old triggers if they exist
DROP TRIGGER IF EXISTS assign_queue_position_trigger ON appointments;
DROP TRIGGER IF EXISTS queue_recalculation_trigger ON appointments;

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS auto_assign_queue_position();
DROP FUNCTION IF EXISTS trigger_queue_recalculation();
DROP FUNCTION IF EXISTS recalculate_queue_positions(UUID, DATE);
DROP FUNCTION IF EXISTS calculate_estimated_start_times(UUID, DATE);
DROP FUNCTION IF EXISTS add_doctor_delay(UUID, DATE, INTEGER);
DROP FUNCTION IF EXISTS insert_emergency_appointment(UUID, UUID, UUID, TIMESTAMPTZ, INTEGER, TEXT);

-- Function to recalculate queue positions for a doctor/date
CREATE OR REPLACE FUNCTION recalculate_queue_positions(
  p_clinic_doctor_id UUID,
  p_service_date DATE
) RETURNS JSONB AS $$
DECLARE
  affected_count INTEGER := 0;
BEGIN
  -- Recalculate queue positions based on priority rules:
  -- 1. in_progress (currently consulting) - position 1
  -- 2. checked_in (waiting in clinic) - by check-in time
  -- 3. scheduled (not yet arrived) - by appointment time
  
  WITH numbered_appointments AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY 
          CASE 
            WHEN status = 'in_progress' THEN 1
            WHEN status = 'checked_in' THEN 2
            WHEN status = 'scheduled' THEN 3
            ELSE 4
          END ASC,
          checked_in_at ASC NULLS LAST,
          appointment_datetime ASC
      ) as new_position
    FROM appointments 
    WHERE clinic_doctor_id = p_clinic_doctor_id 
      AND appointment_datetime::date = p_service_date
      AND status NOT IN ('cancelled', 'no_show', 'completed')
  )
  UPDATE appointments 
  SET 
    queue_position = numbered_appointments.new_position,
    updated_at = NOW()
  FROM numbered_appointments 
  WHERE appointments.id = numbered_appointments.id;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Clear queue position for completed/cancelled appointments
  UPDATE appointments
  SET queue_position = NULL
  WHERE clinic_doctor_id = p_clinic_doctor_id
    AND appointment_datetime::date = p_service_date
    AND status IN ('cancelled', 'no_show', 'completed')
    AND queue_position IS NOT NULL;
  
  RETURN jsonb_build_object(
    'success', true, 
    'recalculated_appointments', affected_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically assign queue position on insert
CREATE OR REPLACE FUNCTION auto_assign_queue_position()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-assign queue position if not provided
  IF NEW.queue_position IS NULL AND NEW.status NOT IN ('cancelled', 'no_show', 'completed') THEN
    SELECT COALESCE(MAX(queue_position), 0) + 1 
    INTO NEW.queue_position
    FROM appointments 
    WHERE clinic_doctor_id = NEW.clinic_doctor_id 
      AND appointment_datetime::date = NEW.appointment_datetime::date
      AND status NOT IN ('cancelled', 'no_show', 'completed');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate queue when appointments change
CREATE OR REPLACE FUNCTION trigger_queue_recalculation()
RETURNS TRIGGER AS $$
DECLARE
  target_doctor_id UUID;
  target_date DATE;
BEGIN
  -- Determine which doctor/date to recalculate
  IF TG_OP = 'DELETE' THEN
    target_doctor_id := OLD.clinic_doctor_id;
    target_date := OLD.appointment_datetime::date;
  ELSE
    target_doctor_id := NEW.clinic_doctor_id;
    target_date := NEW.appointment_datetime::date;
  END IF;
  
  -- Only recalculate if the change affects queue order
  IF TG_OP = 'INSERT' OR 
     TG_OP = 'DELETE' OR
     (TG_OP = 'UPDATE' AND (
       OLD.status IS DISTINCT FROM NEW.status OR
       OLD.checked_in_at IS DISTINCT FROM NEW.checked_in_at OR
       OLD.appointment_datetime::date IS DISTINCT FROM NEW.appointment_datetime::date OR
       OLD.clinic_doctor_id IS DISTINCT FROM NEW.clinic_doctor_id
     )) THEN
    
    -- Recalculate for the target doctor/date
    PERFORM recalculate_queue_positions(target_doctor_id, target_date);
    
    -- If doctor or date changed in UPDATE, also recalculate old doctor/date
    IF TG_OP = 'UPDATE' AND (
      OLD.clinic_doctor_id IS DISTINCT FROM NEW.clinic_doctor_id OR
      OLD.appointment_datetime::date IS DISTINCT FROM NEW.appointment_datetime::date
    ) THEN
      PERFORM recalculate_queue_positions(OLD.clinic_doctor_id, OLD.appointment_datetime::date);
    END IF;
  END IF;
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER assign_queue_position_trigger
  BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_assign_queue_position();

CREATE TRIGGER queue_recalculation_trigger
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_queue_recalculation();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION recalculate_queue_positions TO authenticated;
GRANT EXECUTE ON FUNCTION auto_assign_queue_position TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_queue_recalculation TO authenticated;

-- Manually recalculate queue positions for all active appointments
-- This ensures existing data has correct queue positions
DO $$
DECLARE
  doc_date_record RECORD;
BEGIN
  FOR doc_date_record IN
    SELECT DISTINCT 
      clinic_doctor_id, 
      appointment_datetime::date as service_date
    FROM appointments
    WHERE status NOT IN ('cancelled', 'no_show', 'completed')
      AND appointment_datetime >= CURRENT_DATE - INTERVAL '1 day'
  LOOP
    PERFORM recalculate_queue_positions(
      doc_date_record.clinic_doctor_id, 
      doc_date_record.service_date
    );
  END LOOP;
END $$;

-- Add helpful comment
COMMENT ON FUNCTION recalculate_queue_positions IS 'Automatically recalculates queue positions for a doctor on a specific date. Priority: in_progress > checked_in (by check-in time) > scheduled (by appointment time)';
COMMENT ON FUNCTION auto_assign_queue_position IS 'Automatically assigns next queue position when new appointment is created';
COMMENT ON FUNCTION trigger_queue_recalculation IS 'Triggers automatic queue recalculation when appointments are inserted, updated, or deleted';
