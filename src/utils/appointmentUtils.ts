/**
 * Appointment utility functions
 * Consolidates common appointment logic to avoid duplication
 */

import { AppointmentWithRelations } from "../services/AppointmentService";

/**
 * Determines if an appointment is a video consultation.
 * Checks both the doctor_slot.slot_type and appointment_type fields.
 * 
 * @param appointment - The appointment to check
 * @returns true if it's a video appointment, false otherwise
 */
export function isVideoAppointment(appointment: AppointmentWithRelations | any): boolean {
    const slotType = appointment?.doctor_slot?.slot_type;
    const appointmentType = appointment?.appointment_type?.toLowerCase() || '';

    return slotType === 'video' || appointmentType.includes('video');
}

/**
 * Filters an array of appointments to only include in-clinic appointments
 * (excludes video consultations)
 * 
 * @param appointments - Array of appointments to filter
 * @returns Array of in-clinic appointments only
 */
export function filterInClinicAppointments<T extends AppointmentWithRelations | any>(
    appointments: T[]
): T[] {
    return appointments.filter((appointment) => !isVideoAppointment(appointment));
}

/**
 * Filters an array of appointments to only include video consultations
 * 
 * @param appointments - Array of appointments to filter
 * @returns Array of video appointments only
 */
export function filterVideoAppointments<T extends AppointmentWithRelations | any>(
    appointments: T[]
): T[] {
    return appointments.filter((appointment) => isVideoAppointment(appointment));
}
