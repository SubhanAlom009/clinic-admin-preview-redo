import { z } from "zod";

export const signupSchema = z.object({
  email: z.email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
  name: z
    .string()
    .min(1, { message: "Full name is required" })
    .refine((s) => s.trim().length > 0, { message: "Full name is required" }),
  clinicName: z
    .string()
    .min(1, { message: "Clinic name is required" })
    .refine((s) => s.trim().length > 0, { message: "Clinic name is required" }),
});

export const signInSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});
