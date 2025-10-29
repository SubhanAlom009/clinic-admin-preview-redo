-- Emergency appointment booking
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('emergency_booking_enabled', true, 'Allow patients to book emergency appointments');

-- Video consultations
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('video_consultation_enabled', false, 'Enable video consultation feature (coming soon)');

-- SMS reminders
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('sms_reminders_enabled', true, 'Send SMS reminders 24h before appointment');

-- Online payment
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('online_payment_enabled', false, 'Allow patients to pay consultation fees online');

-- Queue display
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('live_queue_display_enabled', true, 'Show live queue/token numbers to patients');

-- Doctor rating
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('doctor_rating_enabled', false, 'Allow patients to rate doctors after appointment');

-- Prescription upload
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('prescription_upload_enabled', true, 'Allow doctors to upload digital prescriptions');

-- Walk-in registration
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('walkin_registration_enabled', true, 'Allow clinic staff to register walk-in patients');