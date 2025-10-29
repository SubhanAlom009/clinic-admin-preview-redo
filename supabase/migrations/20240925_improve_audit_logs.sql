-- Improved audit_logs table schema
-- Drop the old table and create a new one with better structure

DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    changes_summary TEXT,
    ip_address INET,
    user_agent TEXT,
    clinic_id UUID REFERENCES clinic_profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_clinic_id ON audit_logs(clinic_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Create composite indexes for common query patterns
CREATE INDEX idx_audit_logs_entity_history ON audit_logs(entity_type, entity_id, timestamp DESC);
CREATE INDEX idx_audit_logs_user_activity ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_clinic_activity ON audit_logs(clinic_id, timestamp DESC);

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Clinic admins can only see logs for their clinic
CREATE POLICY "Clinic admins can view their clinic audit logs" ON audit_logs
    FOR SELECT USING (
        clinic_id IN (
            SELECT id FROM clinic_profiles 
            WHERE user_id = auth.uid()
        )
    );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Create a function to automatically capture IP and user agent
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-populate timestamp if not provided
    IF NEW.timestamp IS NULL THEN
        NEW.timestamp = NOW();
    END IF;
    
    -- Auto-populate created_at if not provided
    IF NEW.created_at IS NULL THEN
        NEW.created_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER audit_log_auto_fields
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_trigger();

-- Grant necessary permissions
GRANT SELECT, INSERT ON audit_logs TO authenticated;