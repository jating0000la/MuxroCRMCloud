import { z } from 'zod';

/**
 * Global input validation schemas using Zod
 * Applied to DTOs via class-validator integration
 */

// Regex patterns
export const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const URL_REGEX = /^https?:\/\/.+/;

// Common validators
export const validatePhoneNumber = (phone: string) => {
  if (!phone) return true; // optional field
  return PHONE_REGEX.test(phone.trim());
};

export const validateEmail = (email: string) => {
  if (!email) return true; // optional field
  return EMAIL_REGEX.test(email.trim());
};

export const validateUrl = (url: string) => {
  if (!url) return true; // optional field
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Sanitization
export const sanitizeString = (value: string): string => {
  return value.trim().replace(/[<>]/g, '');
};

export const sanitizeJson = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeJson);
    }
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        acc[key] = sanitizeJson(value);
        return acc;
      },
      {} as Record<string, any>,
    );
  }
  return obj;
};

// Lead validation schema
export const CreateLeadSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  email: z
    .string()
    .email()
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .refine(validatePhoneNumber, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  source: z.enum(['bulk', 'form', 'manual', 'indiamart']).default('manual'),
  customData: z.record(z.any()).optional().default({}),
});

// Form submission validation
export const FormSubmissionSchema = z.object({
  data: z.record(z.any()),
  ipAddress: z.string().optional(),
});

// Bulk import row validation
export const BulkLeadRowSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().refine(validatePhoneNumber, 'Invalid phone number').optional(),
  source: z.string().default('bulk'),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type FormSubmissionInput = z.infer<typeof FormSubmissionSchema>;
export type BulkLeadRowInput = z.infer<typeof BulkLeadRowSchema>;
