import { z } from "zod";

// Location constants for validation
export const STATES = ["West Bengal", "Assam", "Delhi", "Maharashtra"] as const;
const CITIES: Record<string, readonly string[]> = {
  "West Bengal": ["Kolkata"] as const,
  Assam: ["Guwahati"] as const,
  Delhi: ["New Delhi"] as const,
  Maharashtra: ["Mumbai", "Pune"] as const,
};

// Base address schema with required fields
export const addressSchema = z.object({
  address_line1: z
    .string()
    .min(1, { message: "Address Line 1 is required" })
    .refine((s) => s.trim().length > 0, {
      message: "Address Line 1 is required",
    }),

  address_line2: z.string().optional().default(""),

  street: z.string().optional().default(""),

  area: z.string().optional().default(""),

  city: z.string().min(1, { message: "City is required" }),

  state: z.string().min(1, { message: "State is required" }).trim(),

  postal_code: z
    .string()
    .min(1, { message: "Postal code is required" })
    .regex(/^[0-9]{6}$/, { message: "Postal code must be 6 digits" }),

  country: z.string().default("India").optional(),
});

// Form validation schema (allows partial data for form state)
export const addressFormSchema = addressSchema.partial();

// Type inference from Zod schemas
export type Address = z.infer<typeof addressSchema>;
export type AddressFormData = z.infer<typeof addressFormSchema>;

// Validation functions
export function validateAddress(data: Partial<AddressFormData>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  // Ensure all fields exist (convert undefined to empty string for validation)
  const dataToValidate = {
    address_line1: data.address_line1 ?? "",
    address_line2: data.address_line2 ?? "",
    street: data.street ?? "",
    area: data.area ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    postal_code: data.postal_code ?? "",
    country: data.country ?? "India",
  };

  const result = addressSchema.safeParse(dataToValidate);

  if (result.success) {
    return {
      isValid: true,
      errors: {},
    };
  } else {
    const errors: Record<string, string> = {};
    // Use Zod's formatted errors - access via issues property
    if (result.error.issues && Array.isArray(result.error.issues)) {
      result.error.issues.forEach((issue) => {
        if (issue.path && issue.path.length > 0) {
          errors[issue.path[0].toString()] = issue.message;
        }
      });
    }

    console.log("Validation errors:", errors);

    return {
      isValid: false,
      errors,
    };
  }
}

// Display formatting utility
export function formatAddressForDisplay(addr: AddressFormData | null): string {
  if (!addr || typeof addr !== 'object') return "No address provided";
  
  // Check if it's an empty object
  if (Object.keys(addr).length === 0) return "No address provided";

  const parts = [
    addr.address_line1,
    addr.address_line2,
    addr.street,
    addr.area,
    addr.city,
    addr.state,
    addr.postal_code,
    addr.country || "India",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "No address provided";
}

// Helper to get available cities for a state
export function getCitiesForState(
  state: string
): Array<{ value: string; label: string }> {
  if (!state || !(state in CITIES)) {
    return [];
  }
  return CITIES[state].map((city) => ({
    value: city,
    label: city,
  }));
}

// Helper to validate city-state combination
export function validateCityState(city: string, state: string): boolean {
  if (!state || !city) return false;
  const normalizedCity = city.trim().toLowerCase();

  const stateCities = CITIES[state];
  if (!stateCities) return false;

  return stateCities.map((c) => c.toLowerCase()).includes(normalizedCity);
}
