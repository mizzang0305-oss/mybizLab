import { z } from 'zod';

export const inquiryStatusValues = ['new', 'in_progress', 'completed', 'on_hold'] as const;
export const inquiryCategoryValues = ['general', 'reservation', 'group_booking', 'event', 'brand'] as const;

const optionalEmailSchema = z.union([z.string().trim().email('Enter a valid email address.'), z.literal('')]).default('');
const optionalDateSchema = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date.'), z.literal('')]).default('');

export const publicInquirySchema = z
  .object({
    customerName: z.string().trim().min(2, 'Enter at least 2 characters.').max(40, 'Use 40 characters or fewer.'),
    phone: z.string().trim().min(7, 'Enter a reachable phone number.').max(20, 'Use 20 characters or fewer.'),
    email: optionalEmailSchema,
    category: z.enum(inquiryCategoryValues),
    requestedVisitDate: optionalDateSchema,
    message: z.string().trim().min(10, 'Share at least 10 characters.').max(500, 'Use 500 characters or fewer.'),
    marketingOptIn: z.boolean().default(false),
  })
  .transform((value) => ({
    ...value,
    email: value.email || undefined,
    requestedVisitDate: value.requestedVisitDate || undefined,
  }));

export const inquiryOwnerUpdateSchema = z.object({
  status: z.enum(inquiryStatusValues),
  tags: z.array(z.string().trim().min(1).max(24)).max(6, 'Use 6 tags or fewer.').default([]),
  memo: z.string().trim().max(500, 'Use 500 characters or fewer.').default(''),
});

export const customerContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Enter at least 2 characters.').max(40, 'Use 40 characters or fewer.'),
  phone: z.string().trim().min(7, 'Enter a reachable phone number.').max(20, 'Use 20 characters or fewer.'),
  email: optionalEmailSchema,
  marketing_opt_in: z.boolean().default(false),
});

export type PublicInquiryFormInput = z.input<typeof publicInquirySchema>;
export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;
export type InquiryOwnerUpdateInput = z.infer<typeof inquiryOwnerUpdateSchema>;
export type CustomerContactInput = z.infer<typeof customerContactSchema>;

export function normalizeInquiryTags(input: string[]) {
  return [...new Set(input.map((tag) => tag.trim()).filter(Boolean))].slice(0, 6);
}
