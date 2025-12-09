/**
 * Services Index
 * Centralizes all service exports
 */

export { BaseService } from "./BaseService";
export { AppointmentService } from "./AppointmentService";
export { BillingService } from "./BillingService";
export { PatientProfileService } from "./PatientProfileService";
export { DoctorProfileService } from "./DoctorProfileService";
export { ClinicProfileService } from "./ClinicProfileService";
export { WhatsAppService } from "./WhatsAppService";

export type {
  CreateAppointmentData,
  UpdateAppointmentData,
} from "./AppointmentService";

export type { BillData } from "./BillingService";

export type {
  CreatePatientProfileData,
  UpdatePatientProfileData,
  PatientProfileWithClinic,
} from "./PatientProfileService";

export type {
  CreateDoctorProfileData,
  UpdateDoctorProfileData,
  DoctorProfileWithClinic,
} from "./DoctorProfileService";

export type {
  ClinicProfile,
  CreateClinicProfileData,
  UpdateClinicProfileData,
} from "./ClinicProfileService";

export type { ServiceResponse } from "./BaseService";

// Future services to be added:
// export { NotificationService } from './NotificationService';
