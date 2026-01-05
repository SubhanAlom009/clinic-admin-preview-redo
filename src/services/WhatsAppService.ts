/**
 * WhatsApp Business API Service for Clinic Admin
 * Handles sending WhatsApp notifications to patients
 * 
 * TEMPLATE NAMES (Must match Meta Business Suite):
 * - appointment_request_received
 * - inclinic_appointment_confirmed
 * - video_consultation_confirmed (with CTA button)
 * - appointment_rescheduled
 * - appointment_cancelled
 * - appointment_delay
 * - appointment_reminder_1day
 * - video_call_starting_soon (with CTA button)
 */

const WHATSAPP_API_URL = "https://graph.facebook.com/v22.0";
const PHONE_NUMBER_ID = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;

// Patient app base URL for video calls
const PATIENT_APP_BASE_URL = import.meta.env.VITE_PATIENT_APP_URL || "https://patients-webapp.vercel.app";

interface WhatsAppTemplateComponent {
  type: string;
  sub_type?: string;
  index?: number;
  parameters: Array<{
    type: string;
    text?: string;
  }>;
}

interface WhatsAppMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components: WhatsAppTemplateComponent[];
  };
}

export class WhatsAppService {
  /**
   * Base function to send WhatsApp message via Graph API
   */
  private static async sendWhatsAppMessage(
    message: Omit<WhatsAppMessage, "messaging_product">
  ): Promise<{ success: boolean; error?: string; data?: unknown }> {
    console.log("🔔 [CLINIC-ADMIN WhatsApp] sendWhatsAppMessage triggered");
    console.log("📱 [CLINIC-ADMIN WhatsApp] Template:", message.template.name);
    console.log("📞 [CLINIC-ADMIN WhatsApp] Recipient:", message.to);

    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.warn("❌ [CLINIC-ADMIN WhatsApp] Credentials not configured");
      return { success: false, error: "WhatsApp not configured" };
    }

    try {
      const url = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          ...message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("❌ [CLINIC-ADMIN WhatsApp] API error:", data);
        return { success: false, error: data.error?.message || "API error" };
      }

      console.log("✅ [CLINIC-ADMIN WhatsApp] Message sent successfully");
      return { success: true, data };
    } catch (error) {
      console.error("❌ [CLINIC-ADMIN WhatsApp] Send error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Format phone number for WhatsApp (ensure country code)
   */
  private static formatPhone(phone: string): string {
    let cleaned = phone.replace(/[^0-9]/g, "");
    if (cleaned.length === 10 && !cleaned.startsWith("91")) {
      cleaned = "91" + cleaned;
    }
    return cleaned;
  }

  // ============================================================================
  // 1. IN-CLINIC APPOINTMENT CONFIRMED
  // Trigger: When admin approves an in-clinic appointment
  // ============================================================================

  static async sendInClinicAppointmentConfirmed(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    clinicName: string;
    clinicAddress: string;
    appointmentDate: string;
    appointmentTime: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.log("🏥 [CLINIC-ADMIN] Sending in-clinic appointment confirmation");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "inclinic_appointment_confirmed",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.clinicName },
              { type: "text", text: data.clinicAddress },
              { type: "text", text: data.appointmentDate },
              { type: "text", text: data.appointmentTime },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // 2. VIDEO CONSULTATION CONFIRMED (with CTA Button)
  // Trigger: When admin approves a video consultation
  // ============================================================================

  static async sendVideoConsultationConfirmed(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    clinicName: string;
    appointmentDate: string;
    appointmentTime: string;
    feeAmount: string;
    videoCallLinkSuffix: string; // e.g., "abhicure/room?callId=xxx&userId=xxx"
  }): Promise<{ success: boolean; error?: string }> {
    console.log("� [CLINIC-ADMIN] Sending video consultation confirmation");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "video_consultation_confirmed",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.clinicName },
              { type: "text", text: data.appointmentDate },
              { type: "text", text: data.appointmentTime },
              { type: "text", text: data.feeAmount },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              { type: "text", text: data.videoCallLinkSuffix },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // 3. APPOINTMENT CANCELLED
  // Trigger: When admin cancels an appointment
  // ============================================================================

  static async sendAppointmentCancelled(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    appointmentDate: string;
    appointmentTime: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.log("❌ [CLINIC-ADMIN] Sending appointment cancellation");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "appointment_cancelled",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.appointmentDate },
              { type: "text", text: data.appointmentTime },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // 4. APPOINTMENT RESCHEDULED
  // Trigger: When admin reschedules an appointment
  // ============================================================================

  static async sendAppointmentRescheduled(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    oldDate: string;
    oldTime: string;
    newDate: string;
    newTime: string;
    clinicName: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.log("📅 [CLINIC-ADMIN] Sending appointment rescheduled notification");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "appointment_rescheduled",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.oldDate },
              { type: "text", text: data.oldTime },
              { type: "text", text: data.newDate },
              { type: "text", text: data.newTime },
              { type: "text", text: data.clinicName },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // 4B. VIDEO CONSULTATION RESCHEDULED (with new video call link)
  // Trigger: When admin reschedules a video consultation
  // ============================================================================

  static async sendVideoConsultationRescheduled(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    oldDate: string;
    oldTime: string;
    newDate: string;
    newTime: string;
    clinicName: string;
    videoCallLinkSuffix: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.log("📹 [CLINIC-ADMIN] Sending video consultation rescheduled notification");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "video_consultation_rescheduled",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.oldDate },
              { type: "text", text: data.oldTime },
              { type: "text", text: data.newDate },
              { type: "text", text: data.newTime },
              { type: "text", text: data.clinicName },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              { type: "text", text: data.videoCallLinkSuffix },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // 5. APPOINTMENT DELAY
  // Trigger: When doctor is running late
  // ============================================================================

  static async sendAppointmentDelay(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    delayMinutes: string;
    newExpectedTime: string;
    clinicName: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.log("⏰ [CLINIC-ADMIN] Sending appointment delay notification");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "appointment_delay",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.delayMinutes },
              { type: "text", text: data.newExpectedTime },
              { type: "text", text: data.clinicName },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // 6. APPOINTMENT REMINDER (1 Day Before)
  // Trigger: Cron job / scheduled task
  // ============================================================================

  static async sendAppointmentReminder1Day(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    clinicName: string;
    appointmentDate: string;
    appointmentTime: string;
    appointmentType: "In-Clinic Visit" | "Video Consultation";
    extraInfo: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.log("🔔 [CLINIC-ADMIN] Sending 1-day appointment reminder");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "appointment_reminder_1day",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.clinicName },
              { type: "text", text: data.appointmentDate },
              { type: "text", text: data.appointmentTime },
              { type: "text", text: data.appointmentType },
              { type: "text", text: data.extraInfo },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // 7. VIDEO CALL STARTING SOON (with CTA Button)
  // Trigger: 15 minutes before video consultation
  // ============================================================================

  static async sendVideoCallStartingSoon(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    appointmentTime: string;
    videoCallLinkSuffix: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.log("📱 [CLINIC-ADMIN] Sending video call starting soon notification");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "video_call_starting_soon",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.appointmentTime },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              { type: "text", text: data.videoCallLinkSuffix },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // 8. APPOINTMENT REQUEST REJECTED
  // Trigger: When admin rejects a patient's appointment request
  // ============================================================================

  static async sendAppointmentRequestRejected(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    clinicName: string;
    appointmentDate: string;
    appointmentTime: string;
    rejectionReason?: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.log("❌ [CLINIC-ADMIN] Sending appointment request rejected notification");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "appointment_request_rejected",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.clinicName },
              { type: "text", text: data.appointmentDate },
              { type: "text", text: data.appointmentTime },
              { type: "text", text: data.rejectionReason || "Schedule conflict" },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // 9. APPOINTMENT COMPLETED (with Prescription CTA Button)
  // Trigger: When doctor completes the consultation
  // ============================================================================

  static async sendAppointmentCompleted(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    clinicName: string;
    appointmentDate: string;
    prescriptionLinkSuffix: string; // e.g., "clinicSlug/appointments/appointmentId"
  }): Promise<{ success: boolean; error?: string }> {
    console.log("✅ [CLINIC-ADMIN] Sending appointment completed notification with prescription link");

    return await this.sendWhatsAppMessage({
      to: this.formatPhone(data.phone),
      type: "template",
      template: {
        name: "appointment_completed",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.clinicName },
              { type: "text", text: data.appointmentDate },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              { type: "text", text: data.prescriptionLinkSuffix },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // HELPER: Generate Prescription Link
  // ============================================================================

  static generatePrescriptionLink(data: {
    clinicSlug: string;
    appointmentId: string;
  }): { fullUrl: string; ctaSuffix: string } {
    const fullUrl = `${PATIENT_APP_BASE_URL}/${data.clinicSlug}/appointments/${data.appointmentId}`;
    const ctaSuffix = `${data.clinicSlug}/appointments/${data.appointmentId}`;

    return { fullUrl, ctaSuffix };
  }

  // ============================================================================
  // HELPER: Generate Video Call Link Suffix for CTA
  // ============================================================================

  static generateVideoCallLink(data: {
    clinicSlug: string;
    callId: string;
    patientId: string;
    patientName: string;
    appointmentId?: string;
    doctorName?: string;
  }): { fullUrl: string; ctaSuffix: string } {
    const params = new URLSearchParams({
      callId: data.callId,
      userId: `patient-${data.patientId}`,
      userName: data.patientName,
    });

    // Add appointmentId and doctorName for rating page redirect
    if (data.appointmentId) {
      params.set('appointmentId', data.appointmentId);
    }
    if (data.doctorName) {
      params.set('doctorName', data.doctorName);
    }

    // Use /{clinicSlug}/video/room format to match Next.js folder structure
    const fullUrl = `${PATIENT_APP_BASE_URL}/${data.clinicSlug}/video/room?${params.toString()}`;
    const ctaSuffix = `${data.clinicSlug}/video/room?${params.toString()}`;

    return { fullUrl, ctaSuffix };
  }
}
