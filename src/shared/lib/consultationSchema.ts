import { z } from 'zod';

const optionalEmailSchema = z.union([z.string().trim().email('유효한 이메일을 입력해 주세요.'), z.literal('')]).default('');

export const publicConsultationStartSchema = z
  .object({
    customerName: z.string().trim().min(2, '이름을 2자 이상 입력해 주세요.').max(40, '이름은 40자 이하여야 합니다.'),
    phone: z.string().trim().min(7, '연락 가능한 번호를 입력해 주세요.').max(20, '전화번호는 20자 이하여야 합니다.'),
    email: optionalEmailSchema,
    marketingOptIn: z.boolean().default(false),
    message: z.string().trim().min(10, '상담 내용을 10자 이상 입력해 주세요.').max(600, '상담 내용은 600자 이하여야 합니다.'),
  })
  .transform((value) => ({
    ...value,
    email: value.email || undefined,
  }));

export const publicConsultationReplySchema = z.object({
  conversationSessionId: z.string().trim().min(1, '대화 세션이 필요합니다.'),
  message: z.string().trim().min(2, '추가 메시지를 입력해 주세요.').max(600, '메시지는 600자 이하여야 합니다.'),
});

export type PublicConsultationStartFormInput = z.input<typeof publicConsultationStartSchema>;
export type PublicConsultationStartInput = z.infer<typeof publicConsultationStartSchema>;
export type PublicConsultationReplyInput = z.infer<typeof publicConsultationReplySchema>;
