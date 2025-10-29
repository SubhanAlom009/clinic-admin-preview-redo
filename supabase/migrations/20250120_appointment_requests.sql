-- Migration: Add appointment_requests table for patient appointment request workflow
-- Created: 2024-01-20

-- Create appointment_requests table
CREATE TABLE IF NOT EXISTS public.appointment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Patient information (from mobile app)
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20) NOT NULL,
    patient_email VARCHAR(255),
    
    -- Requested appointment details
    clinic_id UUID NOT NULL REFERENCES public.clinic_profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.clinic_doctors(id) ON DELETE CASCADE,
    requested_datetime TIMESTAMPTZ NOT NULL,
    requested_duration INTEGER DEFAULT 30, -- Duration in minutes
    appointment_type VARCHAR(100) NOT NULL,
    
    -- Priority and medical information
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
    symptoms TEXT,
    notes TEXT,
    
    -- Request status and workflow
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    
    -- Admin who processed the request
    processed_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMPTZ,
    
    -- Created appointment (if approved)
    appointment_id UUID REFERENCES public.appointments(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointment_requests_clinic_id ON public.appointment_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_doctor_id ON public.appointment_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_status ON public.appointment_requests(status);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_phone ON public.appointment_requests(patient_phone);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_datetime ON public.appointment_requests(requested_datetime);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_created_at ON public.appointment_requests(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_appointment_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_appointment_requests_updated_at
    BEFORE UPDATE ON public.appointment_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_requests_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Clinic admins can view all requests for their clinic
CREATE POLICY "Clinic admins can view appointment requests"
    ON public.appointment_requests
    FOR SELECT
    USING (
        clinic_id IN (
            SELECT cp.id 
            FROM public.clinic_profiles cp 
            WHERE cp.id = auth.uid()
        )
    );

-- Clinic admins can update requests for their clinic (approve/reject)
CREATE POLICY "Clinic admins can update appointment requests"
    ON public.appointment_requests
    FOR UPDATE
    USING (
        clinic_id IN (
            SELECT cp.id 
            FROM public.clinic_profiles cp 
            WHERE cp.id = auth.uid()
        )
    );

-- Mobile app can insert new requests (when authenticated)
CREATE POLICY "Allow inserting appointment requests"
    ON public.appointment_requests
    FOR INSERT
    WITH CHECK (true); -- Mobile app will need to provide valid clinic_id and doctor_id

-- Add comment for documentation
COMMENT ON TABLE public.appointment_requests IS 'Stores patient appointment requests from mobile app requiring admin approval';
COMMENT ON COLUMN public.appointment_requests.priority IS 'Request priority: normal, high, urgent';
COMMENT ON COLUMN public.appointment_requests.status IS 'Request status: pending, approved, rejected';
COMMENT ON COLUMN public.appointment_requests.appointment_id IS 'References the created appointment if request was approved';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.appointment_requests TO authenticated;