-- Fix RLS policies for appointment_requests table
-- Allow authenticated users to insert appointment requests

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Allow inserting appointment requests" ON public.appointment_requests;

-- Create a more specific policy for authenticated users to insert requests
CREATE POLICY "Authenticated users can insert appointment requests"
    ON public.appointment_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Allow any authenticated user to create appointment requests
        auth.role() = 'authenticated'
        AND clinic_id IS NOT NULL 
        AND doctor_id IS NOT NULL
        AND patient_name IS NOT NULL
        AND patient_phone IS NOT NULL
    );

-- Also allow authenticated users to read their own requests based on phone number
CREATE POLICY "Users can read their own appointment requests"
    ON public.appointment_requests
    FOR SELECT
    TO authenticated
    USING (
        -- Allow users to read requests that match their patient profile phone
        patient_phone IN (
            SELECT pp.phone 
            FROM public.patient_profiles pp 
            WHERE pp.user_id = auth.uid()
        )
    );

-- Allow users to delete their own pending requests (for cancellation)
CREATE POLICY "Users can delete their own pending requests"
    ON public.appointment_requests
    FOR DELETE
    TO authenticated
    USING (
        status = 'pending' 
        AND patient_phone IN (
            SELECT pp.phone 
            FROM public.patient_profiles pp 
            WHERE pp.user_id = auth.uid()
        )
    );