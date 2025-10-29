# Clinic Administration System

A comprehensive clinic management system built with React, TypeScript, and Supabase. This application provides a complete solution for managing patients, doctors, appointments, billing, and real-time queue management.

## 🚀 Features

### Core Management
- **Patient Management**: Complete patient records with contact information, medical history
- **Doctor Management**: Doctor profiles, specializations, schedules, and availability
- **Appointment Scheduling**: Advanced scheduling with conflict detection and queue management
- **Billing System**: Invoice generation, payment tracking, and financial reporting

### Advanced Queue System
- **Real-time Queue Management**: Live updates and position tracking
- **Intelligent Scheduling**: Automatic queue recalculation and ETA updates
- **Patient Check-in**: Streamlined check-in process with status updates
- **Notification System**: Automated patient notifications for delays and updates

### Analytics & Reporting
- **Dashboard Metrics**: Real-time insights into clinic operations
- **Performance Analytics**: Wait times, patient flow, and efficiency metrics
- **Financial Reports**: Revenue tracking and billing analytics

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Real-time subscriptions)
- **Date Management**: date-fns
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Package Manager**: npm

## 📦 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base UI components (Button, Card, Modal, etc.)
│   └── ...              # Feature-specific components
├── pages/               # Main application pages
├── hooks/               # Custom React hooks
├── services/            # API service layer
├── utils/               # Utility functions
├── constants/           # Application constants and enums
├── types/               # TypeScript type definitions
└── lib/                 # Third-party library configurations

supabase/
├── migrations/          # Database schema migrations
└── functions/           # Edge functions
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd clinic-admin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   Run the Supabase migrations:
   ```bash
   # If using Supabase CLI
   supabase db reset
   
   # Or run the migration files manually in your Supabase dashboard
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Build for Production**
   ```bash
   npm run build
   ```

## 🗄️ Database Schema

The application uses a comprehensive PostgreSQL schema with the following main tables:

- `profiles` - User profile information
- `patients` - Patient records and contact information  
- `doctors` - Doctor profiles and specializations
- `appointments` - Appointment scheduling and status tracking
- `bills` - Billing and payment information
- `job_queue` - Background job processing
- `notifications` - Patient notification system
- `appointment_events` - Audit trail for appointment changes

## 🔧 Key Components

### Queue Management
The queue system provides real-time appointment tracking with:
- Automatic position calculation
- ETA estimation and updates
- Patient check-in workflow
- Status transitions (Scheduled → Checked-In → In-Progress → Completed)

### Notification System
Automated notifications for:
- Appointment reminders
- ETA updates (when delays exceed 5 minutes)
- Appointment cancellations/reschedules
- Payment reminders

### Service Layer
Centralized API services for:
- `AppointmentService` - All appointment operations
- `BaseService` - Common functionality and error handling
- Type-safe service responses with proper error handling

## 🎨 UI Components

### Reusable Components
- `FormModal` - Standardized modal forms with loading states
- `ConfirmationModal` - Delete/destructive action confirmations
- Custom UI components with consistent styling

### Constants & Enums
Centralized constants for:
- Appointment statuses
- Billing statuses
- Job queue types
- Time constants
- Validation rules

## 📱 Pages Overview

- **Dashboard** - Overview metrics and recent activity
- **Patients** - Patient management and records
- **Doctors** - Doctor profiles and schedules
- **Appointments** - Calendar view and appointment management
- **Queue** - Real-time queue management interface
- **Billing** - Invoice management and payment tracking
- **Reports** - Analytics and performance metrics

## 🔄 Real-time Features

The application leverages Supabase real-time subscriptions for:
- Live queue updates
- Appointment status changes
- Notification delivery
- Multi-user synchronization

## 🧪 Development

### Code Organization
- **Constants**: All magic strings and repeated values centralized
- **Services**: Database operations abstracted into service classes
- **Type Safety**: Comprehensive TypeScript coverage
- **Error Handling**: Consistent error handling across all services

### Best Practices
- Component composition over inheritance
- Custom hooks for business logic
- Centralized state management where appropriate
- Consistent naming conventions

## 📄 Contributing

1. Follow the existing code structure and naming conventions
2. Add proper TypeScript types for new features
3. Update constants file for any new magic strings
4. Write reusable components when possible
5. Test real-time features thoroughly

## 📋 Environment Variables

Required environment variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- User-based data isolation
- Secure authentication via Supabase Auth
- Input validation and sanitization

## 📚 Additional Documentation

- [Appointment Scheduling Algorithm](./APPOINTMENTSCHEDULINGALGORITHM.md)
- [Feature Roadmap](./FEATURESTOADD.md)
- [Changelog](./CHANGELOG.md)
- [Queue Implementation](./QUEUE_IMPLEMENTATION_SUMMARY.md)

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection**: Ensure environment variables are correct
2. **Real-time Updates**: Check Supabase RLS policies and subscriptions
3. **Build Errors**: Verify all dependencies are installed and TypeScript types are correct

### Performance

- Queue calculations are optimized with database functions
- Real-time subscriptions are scoped to relevant data only
- Components use React.memo and useMemo where appropriate

---

Built with ❤️ for efficient clinic management
