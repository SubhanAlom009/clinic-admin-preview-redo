# Queue System Analysis & Recommendations

## Current Queue Implementation

### Architecture Overview
The current queue system is **NOT using PGMQ** (PostgreSQL Message Queue). Instead, it's using a **custom database-based queue system** with the following components:

### 1. Database Schema
- **Primary Table**: `appointments` table with `queue_position` column
- **Queue Position**: Integer field that determines order in queue
- **Doctor-Date Scoped**: Queue positions are scoped by `clinic_doctor_id` and `appointment_datetime::date` (migration from `doctor_id`)

### 2. Queue Management Functions
Located in: `supabase/migrations/20250906_queue_management_functions.sql`

#### Key Functions:
- `recalculate_queue_positions(clinic_doctor_id, service_date)`: Reorders queue based on appointment time (updated parameter name)
- `calculate_estimated_start_times(clinic_doctor_id, service_date)`: Calculates ETAs for appointments (updated parameter name)
- `auto_assign_queue_position()`: Trigger function to auto-assign queue positions
- `add_doctor_delay(doctor_id, service_date, delay_minutes)`: Handles doctor delays

### 3. Frontend Queue Management
- **Hook**: `useLiveQueue.ts` - Manages queue state and real-time updates
- **Components**: Multiple queue components in `src/components/queueComponents/`
- **Real-time**: Uses Supabase real-time subscriptions for live updates

## Current Queue Logic

### Queue Numbering System
```
Queue Position = ROW_NUMBER() OVER (ORDER BY appointment_datetime ASC)
```

**Current Behavior:**
- Queue positions are **per doctor per day**
- Positions are auto-assigned based on appointment datetime
- When appointments are added/modified, positions are recalculated
- Positions start from 1 and increment sequentially

### Issues with Current Implementation

#### 1. **Single Queue per Doctor-Day**
- ❌ All patients for a doctor on a given day share the same queue
- ❌ No separation by appointment type, specialty, or priority
- ❌ Emergency appointments don't get priority positioning

#### 2. **Queue Position Logic Flaws**
- ❌ Positions recalculate based on appointment time, not check-in time
- ❌ Late arrivals can jump ahead if their appointment time was earlier
- ❌ No handling for walk-in patients
- ❌ Queue position changes when appointments are rescheduled

#### 3. **Missing Queue Types**
- ❌ No separation between consultation types
- ❌ No priority queues for emergencies
- ❌ No separate queues for follow-ups vs new patients

## Recommended Queue System Architecture

### 1. **Multi-Queue System**
Create separate queues for different scenarios:

```sql
-- New table: queue_types
CREATE TABLE queue_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL, -- 'emergency', 'consultation', 'follow_up', 'walk_in'
  priority_level INTEGER NOT NULL, -- 1 = highest priority
  color_code VARCHAR, -- UI color coding
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modified appointments table
ALTER TABLE appointments ADD COLUMN queue_type_id UUID REFERENCES queue_types(id);
ALTER TABLE appointments ADD COLUMN actual_queue_position INTEGER;
ALTER TABLE appointments ADD COLUMN check_in_order INTEGER;
```

### 2. **Improved Queue Logic**

#### Queue Assignment Strategy:
1. **Check-in Based Positioning**: Queue order determined by actual check-in time, not appointment time
2. **Priority-based Queues**: Emergency > Consultation > Follow-up > Walk-in
3. **Doctor-Specialty Specific**: Separate queues per doctor specialty

#### Implementation:
```sql
-- Function to assign queue position on check-in
CREATE OR REPLACE FUNCTION assign_check_in_queue_position()
RETURNS TRIGGER AS $$
BEGIN
  -- Only assign if patient is checking in
  IF NEW.patient_checked_in = true AND OLD.patient_checked_in = false THEN
    -- Get next position based on priority and check-in time
    SELECT COALESCE(MAX(actual_queue_position), 0) + 1
    INTO NEW.actual_queue_position
    FROM appointments a
    JOIN queue_types qt ON a.queue_type_id = qt.id
    WHERE a.doctor_id = NEW.doctor_id
      AND a.appointment_datetime::date = NEW.appointment_datetime::date
      AND a.patient_checked_in = true
      AND qt.priority_level <= (SELECT priority_level FROM queue_types WHERE id = NEW.queue_type_id)
      AND a.status NOT IN ('completed', 'cancelled', 'no_show');
    
    -- Set check-in order
    NEW.check_in_order = EXTRACT(EPOCH FROM NOW());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3. **Queue Types Configuration**

```sql
INSERT INTO queue_types (name, priority_level, color_code) VALUES
('emergency', 1, '#ef4444'),      -- Red - Highest priority
('urgent', 2, '#f97316'),         -- Orange
('consultation', 3, '#3b82f6'),   -- Blue
('follow_up', 4, '#10b981'),      -- Green
('walk_in', 5, '#6b7280');        -- Gray - Lowest priority
```

### 4. **Frontend Queue Implementation**

#### Updated Hook Structure:
```typescript
export interface QueueConfig {
  doctorId: string;
  serviceDate: string;
  queueTypes: QueueType[];
}

export interface QueueAppointment extends Appointment {
  queueType: QueueType;
  actualWaitTime: number;
  estimatedWaitTime: number;
  checkInOrder: number;
}

// Separate queues by type
export const useMultipleQueues = (config: QueueConfig) => {
  const [queues, setQueues] = useState<Map<string, QueueAppointment[]>>();
  
  // Fetch appointments grouped by queue type
  // Calculate wait times per queue
  // Handle priority-based positioning
};
```

## Migration Strategy

### Phase 1: Database Updates
1. Create `queue_types` table
2. Add new columns to `appointments` table
3. Create new queue management functions
4. Migrate existing data with default queue type

### Phase 2: Backend Logic Updates
1. Update appointment creation to assign queue types
2. Implement check-in based queue positioning
3. Add priority-based queue management
4. Update real-time subscription queries

### Phase 3: Frontend Updates
1. Update queue components to handle multiple queue types
2. Add queue type selection in appointment creation
3. Implement priority queue displays
4. Add queue management controls for staff

## Benefits of New System

### 1. **Better Patient Experience**
- ✅ Clear queue position based on actual arrival
- ✅ Separate queues reduce wait times
- ✅ Priority handling for emergencies
- ✅ Accurate wait time estimates

### 2. **Improved Staff Workflow**
- ✅ Better queue management controls
- ✅ Clear visibility of different appointment types
- ✅ Priority-based patient handling
- ✅ Reduced queue confusion

### 3. **Scalability**
- ✅ Easy to add new queue types
- ✅ Configurable priority levels
- ✅ Supports multiple appointment workflows
- ✅ Future-ready for advanced features

## Implementation Priority

### High Priority (Immediate)
1. ✅ Add separate delays column (COMPLETED)
2. Fix queue position logic for check-in based ordering
3. Add queue type categorization

### Medium Priority
1. Implement priority-based queues
2. Add queue management interface
3. Update real-time queue monitoring

### Low Priority
1. Advanced queue analytics
2. Patient queue notifications
3. Queue optimization algorithms

## Conclusion

The current queue system needs significant improvements to handle real-world clinic scenarios effectively. The recommended multi-queue, priority-based system will provide better patient experience and staff workflow while maintaining scalability for future enhancements.
