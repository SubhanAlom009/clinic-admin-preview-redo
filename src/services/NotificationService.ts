/**
 * Notification Service for Clinic Admin
 * Handles sending notifications to patients via email and SMS
 */
import { supabase } from '../lib/supabase';

export interface AppointmentNotificationData {
  doctorName: string;
  appointmentDateTime: string;
  clinicName: string;
  appointmentType?: string;
  symptoms?: string;
  notes?: string;
  rejectionReason?: string;
}

export interface BillingNotificationData {
  billNumber: string;
  totalAmount: number;
  dueDate?: string;
  clinicName: string;
  services?: string[];
}

export interface SystemNotificationData {
  title: string;
  message: string;
  clinicName: string;
  actionUrl?: string;
}

export class NotificationService {
  /**
   * Send appointment notification to patient
   */
  static async sendAppointmentNotification(
    patientId: string,
    event: 'requested' | 'approved' | 'rejected' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled' | 'rescheduled',
    data: AppointmentNotificationData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await supabase.functions.invoke('send-notification', {
        body: {
          type: 'appointment',
          event,
          userId: patientId,
          data,
          channels: ['email', 'sms']
        }
      });

      if (response.error) {
        console.error('Notification service error:', response.error);
        return { success: false, error: response.error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to send appointment notification:', error);
      return { success: false, error: 'Failed to send notification' };
    }
  }

  /**
   * Send billing notification to patient
   */
  static async sendBillingNotification(
    patientId: string,
    event: 'generated' | 'paid' | 'overdue' | 'reminder',
    data: BillingNotificationData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await supabase.functions.invoke('send-notification', {
        body: {
          type: 'billing',
          event,
          userId: patientId,
          data,
          channels: ['email', 'sms']
        }
      });

      if (response.error) {
        console.error('Notification service error:', response.error);
        return { success: false, error: response.error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to send billing notification:', error);
      return { success: false, error: 'Failed to send notification' };
    }
  }

  /**
   * Send system notification to patient
   */
  static async sendSystemNotification(
    patientId: string,
    event: 'emergency' | 'delay' | 'reminder' | 'update',
    data: SystemNotificationData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await supabase.functions.invoke('send-notification', {
        body: {
          type: 'system',
          event,
          userId: patientId,
          data,
          channels: ['email', 'sms']
        }
      });

      if (response.error) {
        console.error('Notification service error:', response.error);
        return { success: false, error: response.error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to send system notification:', error);
      return { success: false, error: 'Failed to send notification' };
    }
  }

  /**
   * Send bulk notifications to multiple patients
   */
  static async sendBulkNotification(
    patientIds: string[],
    type: 'appointment' | 'billing' | 'system',
    event: string,
    data: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await supabase.functions.invoke('send-notification', {
        body: {
          type,
          event,
          userIds: patientIds,
          data,
          channels: ['email', 'sms']
        }
      });

      if (response.error) {
        console.error('Bulk notification service error:', response.error);
        return { success: false, error: response.error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to send bulk notification:', error);
      return { success: false, error: 'Failed to send bulk notification' };
    }
  }
}
