-- Enable PGMQ extension and create queues for queue recalculation and notifications
-- This migration sets up the foundation for robust queue management

-- Enable PGMQ extension in public schema
CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA public;

-- Create queues for queue recalculation and notifications
SELECT pgmq.create('queue_recalc');
SELECT pgmq.create('queue_notifications');

-- RPC function to enqueue queue recalculation jobs
CREATE OR REPLACE FUNCTION public.enqueue_recalc_job(p_clinic_doctor_id uuid, p_service_day date)
RETURNS bigint LANGUAGE sql AS $$
  SELECT pgmq.send('queue_recalc', jsonb_build_object(
    'clinic_doctor_id', p_clinic_doctor_id,
    'service_day', p_service_day,
    'enqueued_at', now()
  ));
$$;

-- RPC function to read queue recalculation jobs (for consumer)
CREATE OR REPLACE FUNCTION public.read_recalc_jobs(p_limit int DEFAULT 10, p_vt_seconds int DEFAULT 30)
RETURNS TABLE (
  msg_id bigint,
  read_ct int,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
) LANGUAGE sql AS $$
  SELECT * FROM pgmq.read('queue_recalc', p_vt_seconds, p_limit);
$$;

-- RPC function to acknowledge (delete) a processed job
CREATE OR REPLACE FUNCTION public.ack_recalc_job(p_msg_id bigint)
RETURNS void LANGUAGE sql AS $$
  SELECT pgmq.delete('queue_recalc', p_msg_id);
$$;

-- RPC function to archive a failed job (for retry/dead letter queue)
CREATE OR REPLACE FUNCTION public.archive_recalc_job(p_msg_id bigint)
RETURNS void LANGUAGE sql AS $$
  SELECT pgmq.archive('queue_recalc', p_msg_id);
$$;

-- RPC function to enqueue notification jobs
CREATE OR REPLACE FUNCTION public.enqueue_notification_job(p_payload jsonb)
RETURNS bigint LANGUAGE sql AS $$
  SELECT pgmq.send('queue_notifications', p_payload);
$$;

-- RPC function to read notification jobs
CREATE OR REPLACE FUNCTION public.read_notification_jobs(p_limit int DEFAULT 10, p_vt_seconds int DEFAULT 30)
RETURNS TABLE (
  msg_id bigint,
  read_ct int,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
) LANGUAGE sql AS $$
  SELECT * FROM pgmq.read('queue_notifications', p_vt_seconds, p_limit);
$$;

-- RPC function to acknowledge notification jobs
CREATE OR REPLACE FUNCTION public.ack_notification_job(p_msg_id bigint)
RETURNS void LANGUAGE sql AS $$
  SELECT pgmq.delete('queue_notifications', p_msg_id);
$$;

-- Add indexes for better performance on queue operations
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor_datetime 
ON public.appointments(clinic_doctor_id, appointment_datetime);

-- Partial index for active appointments (better performance for queue queries)
CREATE INDEX IF NOT EXISTS idx_appointments_active_queue 
ON public.appointments(clinic_doctor_id, appointment_datetime) 
WHERE status IN ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS');

-- Add comments for documentation
COMMENT ON FUNCTION public.enqueue_recalc_job IS 'Enqueues a queue recalculation job for a specific doctor and service day';
COMMENT ON FUNCTION public.read_recalc_jobs IS 'Reads queue recalculation jobs from PGMQ with configurable limit and visibility timeout';
COMMENT ON FUNCTION public.ack_recalc_job IS 'Acknowledges (deletes) a processed queue recalculation job';
COMMENT ON FUNCTION public.archive_recalc_job IS 'Archives a failed queue recalculation job for retry/dead letter handling';
COMMENT ON FUNCTION public.enqueue_notification_job IS 'Enqueues a notification job with custom payload';
COMMENT ON FUNCTION public.read_notification_jobs IS 'Reads notification jobs from PGMQ with configurable limit and visibility timeout';
COMMENT ON FUNCTION public.ack_notification_job IS 'Acknowledges (deletes) a processed notification job';
