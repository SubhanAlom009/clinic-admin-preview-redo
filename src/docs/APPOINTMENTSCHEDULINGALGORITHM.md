# Appointment Scheduling Algorithm for Healthcare Clinic

## Conceptual Overview

Traditional static scheduling assigns fixed time slots but fails to adapt to real-world disruptions like delays, cancellations, or doctor emergencies. This dynamic scheduling system uses event-driven recalculation to propagate changes through the appointment queue in real-time. Every queue modification triggers downstream ETA updates, ensuring patients receive accurate wait times while maximizing doctor utilization through intelligent queue management.

## Data Model Definitions

```sql
-- Patient profiles table
CREATE TABLE patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    date_of_birth DATE,
    emergency_contact TEXT,
    medical_history JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_patient_user_id ON patient_profiles(user_id),
    INDEX idx_patient_phone ON patient_profiles(phone),
    UNIQUE(user_id, phone)
);

-- Doctors table
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialization TEXT NOT NULL,
    consultation_fee DECIMAL(10,2) DEFAULT 0,
    default_consultation_minutes INTEGER DEFAULT 15,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_doctor_user_id ON doctors(user_id),
    INDEX idx_doctor_available ON doctors(is_available),
    UNIQUE(user_id, name)
);

-- Doctor schedules (working hours)
CREATE TABLE doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_schedule_doctor_day ON doctor_schedules(doctor_id, day_of_week),
    UNIQUE(doctor_id, day_of_week, start_time)
);

-- Core appointments table
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patient_profiles(id) ON DELETE CASCADE,
    service_day DATE NOT NULL,
    scheduled_start_time TIMESTAMPTZ NOT NULL,
    expected_duration_minutes INTEGER DEFAULT 15,
    estimated_start_time TIMESTAMPTZ NOT NULL,
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show')),
    queue_position INTEGER NOT NULL,
    patient_checked_in BOOLEAN DEFAULT false,
    checked_in_at TIMESTAMPTZ,
    symptoms TEXT,
    diagnosis TEXT,
    prescription TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Critical indexes for queue operations
    INDEX idx_appointments_doctor_day ON appointments(doctor_id, service_day),
    INDEX idx_appointments_queue ON appointments(doctor_id, service_day, queue_position),
    INDEX idx_appointments_status ON appointments(status),
    INDEX idx_appointments_estimated_start ON appointments(estimated_start_time),
    UNIQUE(doctor_id, service_day, queue_position)
);

-- Doctor breaks and unavailability blocks
CREATE TABLE doctor_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    service_day DATE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    break_type TEXT NOT NULL DEFAULT 'Break' CHECK (break_type IN ('Break', 'Lunch', 'Emergency', 'Unavailable')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_breaks_doctor_day ON doctor_breaks(doctor_id, service_day),
    INDEX idx_breaks_time ON doctor_breaks(start_time, end_time)
);

-- Notification outbox for reliable message delivery
CREATE TABLE notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patient_profiles(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('ETA_UPDATE', 'REMINDER_24H', 'REMINDER_2H', 'CANCELLATION', 'DELAY_ALERT')),
    message_content JSONB NOT NULL,
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('SMS', 'WHATSAPP', 'EMAIL')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    delivery_status TEXT DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED', 'RETRY')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_outbox_scheduled ON notification_outbox(scheduled_for, delivery_status),
    INDEX idx_outbox_appointment ON notification_outbox(appointment_id),
    INDEX idx_outbox_status ON notification_outbox(delivery_status)
);

-- Appointment events audit trail
CREATE TABLE appointment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('CREATED', 'CHECKED_IN', 'STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED', 'ETA_UPDATED')),
    old_values JSONB,
    new_values JSONB,
    triggered_by UUID REFERENCES auth.users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    INDEX idx_events_appointment ON appointment_events(appointment_id),
    INDEX idx_events_type ON appointment_events(event_type),
    INDEX idx_events_timestamp ON appointment_events(timestamp)
);

-- RLS Policy Recommendations:
-- 1. patient_profiles: Users can only see their own clinic's patients (user_id match)
-- 2. appointments: Scope by user_id for clinic isolation
-- 3. doctors: Scope by user_id for multi-tenant clinics
-- 4. notification_outbox: Service role only for Edge Functions
-- 5. appointment_events: Read-only audit trail, scoped by user_id
```

## Algorithm Pseudocode

### RecalculateQueue Function

```typescript
FUNCTION RecalculateQueue(doctor_id, service_day, start_from_queue_position = 1) {
    BEGIN TRANSACTION;
    
    // Lock appointments for this doctor/day to prevent race conditions
  appointments = SELECT * FROM appointments 
          WHERE clinic_doctor_id = $doctor_id 
          AND service_day = $service_day 
          AND queue_position >= $start_from_queue_position
          AND status IN ('Scheduled', 'Checked-In', 'In-Progress')
          ORDER BY queue_position
          FOR UPDATE;
    
    // Get doctor breaks for this day
    breaks = SELECT * FROM doctor_breaks 
             WHERE doctor_id = $doctor_id 
             AND service_day = $service_day 
             ORDER BY start_time;
    
    previous_end_time = NULL;
    
    FOR each appointment IN appointments {
        old_estimated_start = appointment.estimated_start_time;
        
        // Core propagation formula
        IF previous_end_time IS NULL {
            // First appointment or starting fresh
            new_start_time = appointment.scheduled_start_time;
        } ELSE {
            new_start_time = MAX(previous_end_time, appointment.scheduled_start_time);
        }
        
        // Push past any doctor breaks
        FOR each break IN breaks {
            IF new_start_time < break.end_time AND 
               (new_start_time + appointment.expected_duration_minutes) > break.start_time {
                // Appointment overlaps with break, push after break
                new_start_time = break.end_time;
            }
        }
        
        appointment.estimated_start_time = new_start_time;
        previous_end_time = new_start_time + INTERVAL appointment.expected_duration_minutes MINUTE;
        
        // Update in database
        UPDATE appointments 
        SET estimated_start_time = new_start_time, updated_at = NOW()
        WHERE id = appointment.id;
        
        // Check if ETA change exceeds threshold (5 minutes)
        eta_change_minutes = ABS(EXTRACT(EPOCH FROM (new_start_time - old_estimated_start)) / 60);
        
        IF eta_change_minutes >= 5 {
            // Enqueue ETA update notification
            INSERT INTO notification_outbox (
                appointment_id, patient_id, notification_type, message_content, 
                delivery_method, scheduled_for
            ) VALUES (
                appointment.id, 
                appointment.patient_id,
                'ETA_UPDATE',
                JSON_BUILD_OBJECT(
                    'old_eta', old_estimated_start,
                    'new_eta', new_start_time,
                    'delay_minutes', eta_change_minutes,
                    'doctor_name', (SELECT name FROM doctors WHERE id = appointment.doctor_id)
                ),
                'SMS',
                NOW()
            );
        }
        
        // Log the event
        INSERT INTO appointment_events (
            appointment_id, event_type, old_values, new_values, triggered_by
        ) VALUES (
            appointment.id,
            'ETA_UPDATED',
            JSON_BUILD_OBJECT('estimated_start_time', old_estimated_start),
            JSON_BUILD_OBJECT('estimated_start_time', new_start_time),
            current_user_id
        );
    }
    
    COMMIT TRANSACTION;
}
```

### On_Appointment_Complete Function

```typescript
FUNCTION On_Appointment_Complete(completed_appointment_id, actual_end_time = NOW()) {
    BEGIN TRANSACTION;
    
    // Update completed appointment
    UPDATE appointments 
    SET status = 'Completed',
        actual_end_time = $actual_end_time,
        updated_at = NOW()
    WHERE id = $completed_appointment_id;
    
    // Get appointment details
    completed_appt = SELECT doctor_id, service_day, queue_position 
                   FROM appointments 
                   WHERE id = $completed_appointment_id;
    
    // Log completion event
    INSERT INTO appointment_events (
        appointment_id, event_type, new_values, triggered_by
    ) VALUES (
        $completed_appointment_id,
        'COMPLETED',
        JSON_BUILD_OBJECT('actual_end_time', $actual_end_time),
        current_user_id
    );
    
    // Recalculate queue for remaining appointments
    CALL RecalculateQueue(
        completed_appt.doctor_id, 
        completed_appt.service_day, 
        completed_appt.queue_position + 1
    );
    
    COMMIT TRANSACTION;
}
```

### HandlePatientCancellation Function

```typescript
FUNCTION HandlePatientCancellation(appointment_id, cancelled_by) {
    BEGIN TRANSACTION;
    
    // Get appointment details before cancellation
    cancelled_appt = SELECT doctor_id, service_day, queue_position, patient_id
                    FROM appointments 
                    WHERE id = $appointment_id
                    FOR UPDATE;
    
    // Mark as cancelled
    UPDATE appointments 
    SET status = 'Cancelled', updated_at = NOW()
    WHERE id = $appointment_id;
    
    // Compact queue - decrement positions for appointments after cancelled slot
    UPDATE appointments 
    SET queue_position = queue_position - 1, updated_at = NOW()
    WHERE doctor_id = cancelled_appt.doctor_id 
    AND service_day = cancelled_appt.service_day
    AND queue_position > cancelled_appt.queue_position
    AND status IN ('Scheduled', 'Checked-In');
    
    // Notify doctor about cancellation
    INSERT INTO notification_outbox (
        appointment_id, patient_id, notification_type, message_content,
        delivery_method, scheduled_for
    ) VALUES (
        $appointment_id,
        cancelled_appt.patient_id,
        'CANCELLATION',
        JSON_BUILD_OBJECT(
            'cancelled_by', $cancelled_by,
            'original_time', cancelled_appt.scheduled_start_time,
            'queue_position', cancelled_appt.queue_position
        ),
        'SMS',
        NOW()
    );
    
    // Log cancellation event
    INSERT INTO appointment_events (
        appointment_id, event_type, triggered_by, metadata
    ) VALUES (
        $appointment_id,
        'CANCELLED',
        $cancelled_by,
        JSON_BUILD_OBJECT('cancelled_by', $cancelled_by)
    );
    
    // Recalculate queue for remaining appointments
    CALL RecalculateQueue(
        cancelled_appt.doctor_id, 
        cancelled_appt.service_day, 
        cancelled_appt.queue_position
    );
    
    COMMIT TRANSACTION;
}
```

### HandlePatientUpgrade Function

```typescript
FUNCTION HandlePatientUpgrade(doctor_id, service_day) {
    BEGIN TRANSACTION;
    
    // Find next two appointments in queue
    next_appointments = SELECT id, queue_position, patient_checked_in, patient_id
                       FROM appointments 
                       WHERE doctor_id = $doctor_id 
                       AND service_day = $service_day
                       AND status IN ('Scheduled', 'Checked-In')
                       ORDER BY queue_position
                       LIMIT 2
                       FOR UPDATE;
    
    IF COUNT(next_appointments) < 2 {
        RETURN JSON_BUILD_OBJECT('success', false, 'message', 'Not enough appointments to swap');
    }
    
    appointment_n = next_appointments[0];
    appointment_n_plus_1 = next_appointments[1];
    
    // Check upgrade eligibility: N+1 checked in, N has not
    IF appointment_n_plus_1.patient_checked_in = true AND 
       appointment_n.patient_checked_in = false {
        
        // Swap queue positions
        UPDATE appointments 
        SET queue_position = appointment_n_plus_1.queue_position, updated_at = NOW()
        WHERE id = appointment_n.id;
        
        UPDATE appointments 
        SET queue_position = appointment_n.queue_position, updated_at = NOW()
        WHERE id = appointment_n_plus_1.id;
        
        // Log swap events
        INSERT INTO appointment_events (appointment_id, event_type, metadata, triggered_by)
        VALUES 
            (appointment_n.id, 'RESCHEDULED', 
             JSON_BUILD_OBJECT('reason', 'patient_upgrade', 'new_position', appointment_n_plus_1.queue_position), 
             current_user_id),
            (appointment_n_plus_1.id, 'RESCHEDULED', 
             JSON_BUILD_OBJECT('reason', 'patient_upgrade', 'new_position', appointment_n.queue_position), 
             current_user_id);
        
        // Recalculate ETAs for affected appointments
        CALL RecalculateQueue($doctor_id, $service_day, appointment_n.queue_position);
        
        COMMIT TRANSACTION;
        RETURN JSON_BUILD_OBJECT('success', true, 'swapped_appointments', ARRAY[appointment_n.id, appointment_n_plus_1.id]);
    } ELSE {
        ROLLBACK TRANSACTION;
        RETURN JSON_BUILD_OBJECT('success', false, 'message', 'Upgrade conditions not met');
    }
}
```

### HandleNoShow Function

```typescript
FUNCTION HandleNoShow(appointment_id) {
    BEGIN TRANSACTION;
    
    // Mark as no-show
    UPDATE appointments 
    SET status = 'No-Show', updated_at = NOW()
    WHERE id = $appointment_id;
    
    // Get appointment details
    no_show_appt = SELECT doctor_id, service_day, queue_position, patient_id
                  FROM appointments 
                  WHERE id = $appointment_id;
    
    // Log no-show event
    INSERT INTO appointment_events (
        appointment_id, event_type, triggered_by
    ) VALUES (
        $appointment_id,
        'NO_SHOW',
        current_user_id
    );
    
    // Recalculate queue for remaining appointments
    CALL RecalculateQueue(
        no_show_appt.doctor_id, 
        no_show_appt.service_day, 
        no_show_appt.queue_position + 1
    );
    
    COMMIT TRANSACTION;
}
```

### HandleDoctorEmergencyUnavailability Function

```typescript
FUNCTION HandleDoctorEmergencyUnavailability(doctor_id, block_start, block_end) {
    BEGIN TRANSACTION;
    
    // Mark doctor as unavailable
    UPDATE doctors 
    SET is_available = false, updated_at = NOW()
    WHERE id = $doctor_id;
    
    // Insert unavailability block
    INSERT INTO doctor_breaks (
        doctor_id, service_day, start_time, end_time, break_type, reason
    ) VALUES (
        $doctor_id, 
        DATE($block_start), 
        $block_start, 
        $block_end, 
        'Emergency', 
        'Doctor emergency unavailability'
    );
    
    // Find affected appointments
    affected_appointments = SELECT id, patient_id, scheduled_start_time
                           FROM appointments 
                           WHERE doctor_id = $doctor_id 
                           AND estimated_start_time BETWEEN $block_start AND $block_end
                           AND status IN ('Scheduled', 'Checked-In')
                           FOR UPDATE;
    
    // Cancel affected appointments
    FOR each appointment IN affected_appointments {
        UPDATE appointments 
        SET status = 'Cancelled', updated_at = NOW()
        WHERE id = appointment.id;
        
        // Notify patients about cancellation
        INSERT INTO notification_outbox (
            appointment_id, patient_id, notification_type, message_content,
            delivery_method, scheduled_for
        ) VALUES (
            appointment.id,
            appointment.patient_id,
            'CANCELLATION',
            JSON_BUILD_OBJECT(
                'reason', 'doctor_emergency',
                'original_time', appointment.scheduled_start_time,
                'message', 'Your appointment has been cancelled due to doctor unavailability. Please reschedule.'
            ),
            'SMS',
            NOW()
        );
    }
    
    // Recalculate remaining appointments for the day
    CALL RecalculateQueue($doctor_id, DATE($block_start), 1);
    
    COMMIT TRANSACTION;
}
```

### HandleDoctorBreak Function

```typescript
FUNCTION HandleDoctorBreak(doctor_id, service_day, start_time, duration_minutes) {
    BEGIN TRANSACTION;
    
    end_time = start_time + INTERVAL duration_minutes MINUTE;
    
    // Insert break record
    INSERT INTO doctor_breaks (
        doctor_id, service_day, start_time, end_time, break_type
    ) VALUES (
        $doctor_id, $service_day, $start_time, end_time, 'Break'
    );
    
    // Force recalculation to account for new break
    CALL RecalculateQueue($doctor_id, $service_day, 1);
    
    COMMIT TRANSACTION;
}
```

## Edge Cases Handling

### Doctor Delay
1. When doctor starts late, system detects via appointment start time vs scheduled time
2. Calculate delay duration and update actual_start_time
3. Call RecalculateQueue() to propagate delay to all subsequent appointments
4. Automatic ETA notifications sent to patients with delays ≥5 minutes
5. Queue positions remain unchanged, only ETAs shift forward

### Patient Cancellation
1. Mark appointment status as 'Cancelled'
2. Compact queue by decrementing positions of all appointments after cancelled slot
3. Notify doctor about schedule gap via notification_outbox
4. Trigger RecalculateQueue() to pull forward all subsequent appointments
5. ETAs improve for remaining patients, triggering positive ETA notifications

### Patient Upgrade on Early Arrival
1. System checks if N+1 is checked in but N is not
2. Presents swap suggestion to clinic staff
3. On confirmation, atomically swap queue_position values
4. RecalculateQueue() updates ETAs for both swapped appointments and downstream
5. Fairness rule: Only allow if it doesn't disadvantage other checked-in patients

### Doctor Emergency Unavailability
1. Mark doctor.is_available = false immediately
2. Insert emergency break block covering unavailable period
3. Cancel all appointments overlapping with unavailability window
4. Send cancellation notifications with rescheduling instructions
5. RecalculateQueue() handles remaining appointments after emergency period

### Patient No-Show
1. Mark appointment as 'No-Show' after grace period (e.g., 15 minutes)
2. Keep queue position to maintain order integrity
3. RecalculateQueue() from next position to pull forward subsequent appointments
4. No-show doesn't affect queue positions, only improves ETAs for others

### Doctor-Initiated Break
1. Insert break record with specified duration
2. RecalculateQueue() automatically detects break and pushes appointments past it
3. Notifications sent for appointments with significant ETA changes
4. Break treated as immovable appointment block in timeline

## Notification System Logic

### Triggers
- **ETA Changes**: ≥5 minute changes in estimated_start_time
- **Scheduled Reminders**: 24h and 2h before estimated_start_time
- **Cancellations**: Patient or doctor-initiated cancellations
- **Delays**: Real-time alerts when appointments run significantly over

### Content Templates
```json
{
  "ETA_UPDATE": {
    "message": "Your appointment with Dr. {doctor_name} has been {delayed/advanced} by {minutes} minutes. New estimated time: {new_eta_formatted}",
    "fields": ["doctor_name", "delay_minutes", "new_eta", "appointment_id"]
  },
  "REMINDER_24H": {
    "message": "Reminder: You have an appointment with Dr. {doctor_name} tomorrow at {eta_formatted}. Please arrive 15 minutes early.",
    "fields": ["doctor_name", "eta_formatted", "clinic_address"]
  },
  "REMINDER_2H": {
    "message": "Your appointment with Dr. {doctor_name} is in 2 hours (ETA: {eta_formatted}). Current queue position: {queue_position}",
    "fields": ["doctor_name", "eta_formatted", "queue_position"]
  }
}
```

### Delivery Mechanism
- **Edge Functions**: Process notification_outbox every 1 minute
- **Twilio/WhatsApp**: Send SMS and WhatsApp messages via API
- **Idempotency**: Check sent_at timestamp before sending
- **Retry Logic**: Exponential backoff for failed deliveries (max 3 retries)

### Scheduling
- **24h Reminders**: Scheduled when appointment is created
- **2h Reminders**: Scheduled dynamically based on current ETA
- **Real-time Alerts**: Immediate processing via triggers

## Supabase Mapping

### Edge Functions vs DB Triggers vs Realtime
- **Edge Functions**: Queue recalculation, notification processing, complex business logic
- **DB Triggers**: Audit logging, automatic timestamp updates, data validation
- **Realtime Subscriptions**: Live queue updates to React frontend, ETA changes

### Notification Outbox Pattern
```typescript
// Edge Function worker (runs every minute)
const processNotifications = async () => {
  const pending = await supabase
    .from('notification_outbox')
    .select('*')
    .eq('delivery_status', 'PENDING')
    .lte('scheduled_for', new Date().toISOString())
    .limit(50);
    
  for (const notification of pending.data) {
    try {
      await sendNotification(notification);
      await markAsSent(notification.id);
    } catch (error) {
      await markAsFailed(notification.id, error.message);
    }
  }
};
```

### Security
- **Service Role Key**: Only for Edge Functions, never in client code
- **RLS Policies**: Enforce user_id scoping for multi-tenant isolation
- **API Authentication**: Verify JWT tokens in Edge Functions

## API Endpoint Suggestions

### POST /appointments
- **Purpose**: Create new appointment
- **Auth**: Clinic admin/staff role
- **Body**: `{doctor_id, patient_id, service_day, scheduled_start_time, expected_duration_minutes}`
- **Side Effects**: Assigns queue_position, calculates initial ETA, schedules reminders

### POST /appointments/{id}/checkin
- **Purpose**: Mark patient as checked in
- **Auth**: Clinic staff role
- **Body**: `{checked_in_at?}`
- **Side Effects**: Sets patient_checked_in=true, may trigger upgrade suggestions

### POST /appointments/{id}/start
- **Purpose**: Start appointment (doctor begins consultation)
- **Auth**: Doctor or clinic staff
- **Body**: `{actual_start_time?}`
- **Side Effects**: Updates status to 'In-Progress', recalculates queue if delayed

### POST /appointments/{id}/complete
- **Purpose**: Complete appointment
- **Auth**: Doctor or clinic staff
- **Body**: `{actual_end_time?, diagnosis?, prescription?, notes?}`
- **Side Effects**: Triggers On_Appointment_Complete(), recalculates downstream queue

### POST /appointments/{id}/cancel
- **Purpose**: Cancel appointment
- **Auth**: Patient, doctor, or clinic staff
- **Body**: `{reason?, cancelled_by}`
- **Side Effects**: Compacts queue, notifies affected parties, recalculates ETAs

### POST /appointments/{id}/no-show
- **Purpose**: Mark patient as no-show
- **Auth**: Clinic staff role
- **Body**: `{marked_at?}`
- **Side Effects**: Changes status, improves ETAs for subsequent patients

### POST /queue/{doctor_id}/{service_day}/upgrade
- **Purpose**: Suggest or execute patient queue upgrade
- **Auth**: Clinic staff role
- **Body**: `{execute: boolean}`
- **Side Effects**: May swap positions, recalculate affected ETAs

### POST /doctors/{doctor_id}/breaks
- **Purpose**: Add doctor break/lunch
- **Auth**: Doctor or clinic admin
- **Body**: `{start_time, duration_minutes, break_type?, reason?}`
- **Side Effects**: Inserts break, pushes appointments past break time

### POST /doctors/{doctor_id}/unavailable
- **Purpose**: Mark doctor emergency unavailable
- **Auth**: Clinic admin role
- **Body**: `{start_time, end_time, reason}`
- **Side Effects**: Cancels affected appointments, notifies patients

### POST /recalc
- **Purpose**: Manual queue recalculation (admin tool)
- **Auth**: Clinic admin role
- **Body**: `{doctor_id, service_day, start_from_position?}`
- **Side Effects**: Forces RecalculateQueue() execution

### POST /notifications/cron-digest
- **Purpose**: Process notification outbox (cron job)
- **Auth**: Service role (internal)
- **Body**: `{batch_size?}`
- **Side Effects**: Sends pending notifications, updates delivery status

## React Integration Hints

```typescript
// Custom hook for live queue monitoring
export const useLiveQueue = (doctorId: string, serviceDay: string) => {
  const [queue, setQueue] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Initial fetch
    const fetchQueue = async () => {
      const { data } = await supabase
        .from('appointments')
        .select(`
          *, 
          patient:patient_profiles(*),
          doctor:doctors(*)
        `)
        .eq('doctor_id', doctorId)
        .eq('service_day', serviceDay)
        .in('status', ['Scheduled', 'Checked-In', 'In-Progress'])
        .order('queue_position');
      
      setQueue(data || []);
      setLoading(false);
    };
    
    fetchQueue();
    
    // Subscribe to realtime changes
    const subscription = supabase
      .channel(`queue:${doctorId}:${serviceDay}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `doctor_id=eq.${doctorId}`,
      }, (payload) => {
        // Refetch queue on any appointment change
        fetchQueue();
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, [doctorId, serviceDay]);
  
  return { queue, loading };
};

// Usage in component
const QueueMonitor = ({ doctorId, serviceDay }) => {
  const { queue, loading } = useLiveQueue(doctorId, serviceDay);
  
  if (loading) return <div>Loading queue...</div>;
  
  return (
    <div className="space-y-4">
      {queue.map((appointment) => (
        <div key={appointment.id} className="border rounded p-4">
          <div className="flex justify-between">
            <span>#{appointment.queue_position} - {appointment.patient?.name}</span>
            <span>ETA: {format(appointment.estimated_start_time, 'HH:mm')}</span>
          </div>
          <div className="text-sm text-gray-600">
            Status: {appointment.status} | 
            Checked In: {appointment.patient_checked_in ? 'Yes' : 'No'}
          </div>
        </div>
      ))}
    </div>
  );
};
```

## Performance & Safety Notes

### Transaction Strategy
- **Queue Operations**: Always use SELECT ... FOR UPDATE to prevent race conditions
- **Atomic Swaps**: Wrap position changes in single transaction
- **Batch Processing**: Process notifications in batches of 50 to avoid memory issues

### Scaling Considerations
- **100+ patients/day**: Use database indexes on (doctor_id, service_day, queue_position)
- **Connection Pooling**: Configure Supabase connection limits appropriately
- **Query Optimization**: Use EXPLAIN ANALYZE for queue recalculation performance

### Race Condition Avoidance
- **Row-level Locking**: FOR UPDATE on appointment records during queue modifications
- **Idempotent Operations**: Check current state before making changes
- **Event Sourcing**: Use appointment_events table for audit and debugging

### Monitoring Metrics
- **Queue Latency**: Average time between status changes and ETA updates
- **Notification Failure Rate**: Percentage of failed SMS/WhatsApp deliveries
- **Doctor Utilization**: Actual consultation time vs scheduled time
- **Patient Wait Time**: Difference between estimated and actual start times

## Example Scenario Walkthroughs

### Scenario 1: 20-minute Delayed Appointment
```
Initial State (10:00 AM):
- Appointment A: 10:00-10:15 (Position 1, ETA 10:00)
- Appointment B: 10:15-10:30 (Position 2, ETA 10:15)  
- Appointment C: 10:30-10:45 (Position 3, ETA 10:30)

10:20 AM - Appointment A completes (20 min delay):
1. actual_end_time = 10:20 AM
2. RecalculateQueue(doctor_id, service_day, position=2)
3. Appointment B: new ETA = MAX(10:20, 10:15) = 10:20 (5 min delay → notification)
4. Appointment C: new ETA = MAX(10:35, 10:30) = 10:35 (5 min delay → notification)

Result: Cascade delay propagated with notifications sent
```

### Scenario 2: Early Arrival Swap
```
Initial State:
- Appointment N: Position 2, Patient not checked in, ETA 10:15
- Appointment N+1: Position 3, Patient checked in at 9:50, ETA 10:30

10:05 AM - Staff initiates upgrade check:
1. HandlePatientUpgrade(doctor_id, service_day)
2. Conditions met: N+1 checked in, N not checked in
3. Atomic swap: N→Position 3, N+1→Position 2
4. RecalculateQueue(doctor_id, service_day, position=2)
5. N+1 new ETA: 10:15 (15 min improvement → notification)
6. N new ETA: 10:30 (15 min delay → notification)

Result: Early patient served sooner, late patient maintains fair position
```

## Optional: TypeScript Edge Function Template

```typescript
// Edge Function: complete-appointment
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Denv.get('SUPABASE_URL')!,
      Denv.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { appointment_id, actual_end_time, diagnosis, prescription, notes } = await req.json();

    // Start transaction
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('doctor_id, service_day, queue_position, patient_id')
      .eq('id', appointment_id)
      .single();

    if (fetchError) throw fetchError;

    // Complete appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'Completed',
        actual_end_time: actual_end_time || new Date().toISOString(),
        diagnosis,
        prescription,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment_id);

    if (updateError) throw updateError;

    // Log completion event
    await supabase
      .from('appointment_events')
      .insert({
        appointment_id,
        event_type: 'COMPLETED',
        new_values: { actual_end_time, diagnosis, prescription },
        timestamp: new Date().toISOString()
      });

    // Trigger queue recalculation for subsequent appointments
    const { error: recalcError } = await supabase.rpc('recalculate_queue', {
      p_doctor_id: appointment.doctor_id,
      p_service_day: appointment.service_day,
      p_start_from_position: appointment.queue_position + 1
    });

    if (recalcError) throw recalcError;

    return new Response(
      JSON.stringify({ success: true, appointment_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

This comprehensive appointment scheduling algorithm provides a robust, real-time solution for healthcare clinics with proper concurrency handling, notification systems, and scalability considerations.