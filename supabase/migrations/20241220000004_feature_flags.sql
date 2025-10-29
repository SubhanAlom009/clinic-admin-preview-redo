-- Feature flags for queue system migration
-- This migration creates a feature flag system to switch between legacy job_queue and PGMQ

-- Create feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text UNIQUE NOT NULL,
  flag_value boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert the PGMQ feature flag
INSERT INTO feature_flags (flag_name, flag_value, description) 
VALUES (
  'use_pgmq_for_queue_recalc', 
  true, 
  'Use PGMQ for queue recalculation instead of legacy job_queue'
) ON CONFLICT (flag_name) DO UPDATE SET 
  flag_value = EXCLUDED.flag_value,
  updated_at = now();

-- Function to get feature flag value
CREATE OR REPLACE FUNCTION get_feature_flag(p_flag_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  flag_value boolean;
BEGIN
  SELECT ff.flag_value INTO flag_value
  FROM feature_flags ff
  WHERE ff.flag_name = p_flag_name;
  
  RETURN COALESCE(flag_value, false);
END;
$$;

-- Function to set feature flag value
CREATE OR REPLACE FUNCTION set_feature_flag(p_flag_name text, p_flag_value boolean, p_description text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO feature_flags (flag_name, flag_value, description)
  VALUES (p_flag_name, p_flag_value, p_description)
  ON CONFLICT (flag_name) DO UPDATE SET
    flag_value = EXCLUDED.flag_value,
    description = COALESCE(EXCLUDED.description, feature_flags.description),
    updated_at = now();
  
  RETURN true;
END;
$$;

-- Function to get all feature flags
CREATE OR REPLACE FUNCTION get_all_feature_flags()
RETURNS TABLE (
  flag_name text,
  flag_value boolean,
  description text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ff.flag_name,
    ff.flag_value,
    ff.description,
    ff.created_at,
    ff.updated_at
  FROM feature_flags ff
  ORDER BY ff.flag_name;
END;
$$;

-- Add RLS policies for feature flags (admin only)
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can read feature flags
CREATE POLICY "Users can read feature flags" ON feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only service role can modify feature flags
CREATE POLICY "Service role can modify feature flags" ON feature_flags
  FOR ALL
  TO service_role
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE feature_flags IS 'Feature flags for controlling system behavior and migrations';
COMMENT ON FUNCTION get_feature_flag IS 'Get the value of a feature flag by name';
COMMENT ON FUNCTION set_feature_flag IS 'Set the value of a feature flag by name';
COMMENT ON FUNCTION get_all_feature_flags IS 'Get all feature flags with their values and descriptions';

-- Create a view for easy feature flag access
CREATE OR REPLACE VIEW current_feature_flags AS
SELECT 
  flag_name,
  flag_value,
  description,
  updated_at
FROM feature_flags
ORDER BY flag_name;

COMMENT ON VIEW current_feature_flags IS 'Current feature flags with their values and descriptions';
