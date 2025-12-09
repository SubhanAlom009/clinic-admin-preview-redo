/**
 * WhatsApp Business API Service for Clinic Admin
 * Handles sending WhatsApp notifications to patients
 */

const WHATSAPP_API_URL = "https://graph.facebook.com/v22.0";
const PHONE_NUMBER_ID = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;

interface WhatsAppTemplateComponent {
  type: string;
  parameters: Array<{
    type: string;
    text: string;
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
    console.log(
      "📱 [CLINIC-ADMIN WhatsApp] Message details:",
      JSON.stringify(message, null, 2)
    );
    console.log(
      "� [CLINIC-ADMIN WhatsApp] Recipient phone number (TO field):",
      message.to
    );
    console.log("�🔑 [CLINIC-ADMIN WhatsApp] Environment check:", {
      hasPhoneNumberId: !!PHONE_NUMBER_ID,
      hasAccessToken: !!ACCESS_TOKEN,
      phoneNumberId: PHONE_NUMBER_ID || "NOT SET",
    });

    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.warn(
        "❌ [CLINIC-ADMIN WhatsApp] WhatsApp credentials not configured. Skipping notification."
      );
      return { success: false, error: "WhatsApp not configured" };
    }

    try {
      const url = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;
      console.log("🌐 [CLINIC-ADMIN WhatsApp] Sending request to:", url);

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
      console.log(
        "📡 [CLINIC-ADMIN WhatsApp] Response status:",
        response.status,
        response.statusText
      );

      if (!response.ok) {
        console.error("❌ [CLINIC-ADMIN WhatsApp] API error:", data);
        return { success: false, error: data.error?.message || "API error" };
      }

      console.log(
        "✅ [CLINIC-ADMIN WhatsApp] Message sent successfully:",
        data
      );
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
    // Remove all non-digits
    let cleaned = phone.replace(/[^0-9]/g, "");

    // If the number doesn't start with country code (91 for India), add it
    if (cleaned.length === 10 && !cleaned.startsWith("91")) {
      cleaned = "91" + cleaned;
    }

    console.log(
      "📱 [formatPhone] Input:",
      phone,
      "→ Output:",
      cleaned,
      `(${cleaned.length} digits)`
    );

    return cleaned;
  }

  /**
   * Send appointment confirmation when admin approves request
   */
  static async sendAppointmentConfirmed(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    clinicName: string;
    appointmentDate: string;
    appointmentTime: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.log(
      "🚀 [CLINIC-ADMIN] sendAppointmentConfirmed called with:",
      data
    );

    const formattedPhone = this.formatPhone(data.phone);
    console.log(
      "📞 [CLINIC-ADMIN] Phone formatted:",
      data.phone,
      "→",
      formattedPhone
    );
    console.log(
      "🔍 [CLINIC-ADMIN] Exact phone being sent to WhatsApp API:",
      formattedPhone
    );
    console.log(
      "📏 [CLINIC-ADMIN] Phone length:",
      formattedPhone.length,
      "characters"
    );

    return await this.sendWhatsAppMessage({
      to: formattedPhone,
      type: "template",
      template: {
        name: "appointment_confirmed",
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: data.clinicName },
              { type: "text", text: data.appointmentDate },
              { type: "text", text: data.appointmentTime },
            ],
          },
        ],
      },
    });
  }

  /**
   * Send appointment cancellation notification
   */
  static async sendAppointmentCancelled(data: {
    phone: string;
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    reason?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const formattedPhone = this.formatPhone(data.phone);

    return await this.sendWhatsAppMessage({
      to: formattedPhone,
      type: "template",
      template: {
        name: "appointment_cancelled",
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.appointmentDate },
              { type: "text", text: data.appointmentTime },
            ],
          },
        ],
      },
    });
  }

  /**
   * Send appointment reminder (1 day before)
   */
  static async sendAppointmentReminder(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    appointmentDate: string;
    appointmentTime: string;
  }): Promise<{ success: boolean; error?: string }> {
    const formattedPhone = this.formatPhone(data.phone);

    return await this.sendWhatsAppMessage({
      to: formattedPhone,
      type: "template",
      template: {
        name: "appointment_reminder",
        language: {
          code: "en",
        },
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

  /**
   * Send reschedule confirmation
   */
  static async sendRescheduleConfirmed(data: {
    phone: string;
    patientName: string;
    doctorName: string;
    oldDate: string;
    oldTime: string;
    newDate: string;
    newTime: string;
  }): Promise<{ success: boolean; error?: string }> {
    const formattedPhone = this.formatPhone(data.phone);

    // Use appointment_confirmed template with new date/time
    return await this.sendWhatsAppMessage({
      to: formattedPhone,
      type: "template",
      template: {
        name: "appointment_confirmed",
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: data.patientName },
              { type: "text", text: data.doctorName },
              { type: "text", text: "Rescheduled Appointment" },
              { type: "text", text: data.newDate },
              { type: "text", text: data.newTime },
            ],
          },
        ],
      },
    });
  }

  /**
   * Send OTP for verification
   */
  static async sendOTP(
    phone: string,
    otp: string
  ): Promise<{ success: boolean; error?: string }> {
    const formattedPhone = this.formatPhone(phone);

    return await this.sendWhatsAppMessage({
      to: formattedPhone,
      type: "template",
      template: {
        name: "otp_verification",
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: otp }],
          },
        ],
      },
    });
  }
}
