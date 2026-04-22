import { z } from "zod";

export const complaintFormSchema = z.object({
  // Personal info
  submitter_name: z.string().min(2, "Full name is required"),
  submitter_employee_id: z.string().min(1, "Employee ID is required"),
  submitter_email: z.string().email("Invalid email").optional().or(z.literal("")),
  submitter_phone: z.string().optional(),
  plant: z.enum(["P1", "P2", "BK"], { required_error: "Please select a plant" }),

  // Description
  description: z
    .string()
    .min(10, "Please describe the issue (min 10 characters)")
    .max(1000, "Maximum 1000 characters"),

  // Category-specific data (validated contextually in form)
  category_data: z.record(z.string(), z.unknown()).optional(),
});

export type ComplaintFormValues = z.infer<typeof complaintFormSchema>;
