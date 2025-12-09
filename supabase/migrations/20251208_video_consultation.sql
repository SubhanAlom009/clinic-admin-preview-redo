-- Add video consultation columns to appointments table
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS video_call_id TEXT,
  ADD COLUMN IF NOT EXISTS video_room_url TEXT;
-- Add comments
COMMENT ON COLUMN public.appointments.video_call_id IS 'Stream.io call ID for video consultations';
COMMENT ON COLUMN public.appointments.video_room_url IS 'Full URL to join video call';
-- Create index for video appointments
CREATE INDEX IF NOT EXISTS idx_appointments_video_call_id 
  ON public.appointments(video_call_id) 
  WHERE video_call_id IS NOT NULL;