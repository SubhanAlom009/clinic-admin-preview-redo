-- Create reschedule_requests table
CREATE TABLE IF NOT EXISTS reschedule_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinic_profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES clinic_doctors(id) ON DELETE CASCADE,
    current_datetime TIMESTAMPTZ NOT NULL,
    requested_datetime TIMESTAMPTZ NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    processed_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_clinic_id ON reschedule_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_patient_profile_id ON reschedule_requests(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_appointment_id ON reschedule_requests(appointment_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_status ON reschedule_requests(status);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_created_at ON reschedule_requests(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE reschedule_requests ENABLE ROW LEVEL SECURITY;

-- Policy for clinic admins to view their clinic's reschedule requests
CREATE POLICY "Clinic admins can view their reschedule requests" ON reschedule_requests
    FOR SELECT USING (
        auth.uid() = clinic_id::text::uuid OR
        EXISTS (
            SELECT 1 FROM clinic_profiles 
            WHERE clinic_profiles.id = reschedule_requests.clinic_id 
            AND clinic_profiles.id::text = auth.uid()::text
        )
    );

-- Policy for patients to view their own reschedule requests
CREATE POLICY "Patients can view their own reschedule requests" ON reschedule_requests
    FOR SELECT USING (
        auth.uid() = patient_profile_id::text::uuid OR
        EXISTS (
            SELECT 1 FROM patient_profiles 
            WHERE patient_profiles.id = reschedule_requests.patient_profile_id 
            AND patient_profiles.user_id = auth.uid()
        )
    );

-- Policy for patients to create reschedule requests
CREATE POLICY "Patients can create reschedule requests" ON reschedule_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM patient_profiles 
            WHERE patient_profiles.id = patient_profile_id 
            AND patient_profiles.user_id = auth.uid()
        )
    );

-- Policy for clinic admins to update reschedule requests (approve/reject)
CREATE POLICY "Clinic admins can update their reschedule requests" ON reschedule_requests
    FOR UPDATE USING (
        auth.uid() = clinic_id::text::uuid OR
        EXISTS (
            SELECT 1 FROM clinic_profiles 
            WHERE clinic_profiles.id = reschedule_requests.clinic_id 
            AND clinic_profiles.id::text = auth.uid()::text
        )
    );

-- Policy for patients to delete their own pending reschedule requests
CREATE POLICY "Patients can delete their own pending reschedule requests" ON reschedule_requests
    FOR DELETE USING (
        status = 'pending' AND
        EXISTS (
            SELECT 1 FROM patient_profiles 
            WHERE patient_profiles.id = reschedule_requests.patient_profile_id 
            AND patient_profiles.user_id = auth.uid()
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reschedule_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reschedule_requests_updated_at
    BEFORE UPDATE ON reschedule_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_reschedule_requests_updated_at();