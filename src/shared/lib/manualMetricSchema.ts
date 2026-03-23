import { z } from 'zod';

export const manualMetricFormSchema = z.object({
  metricDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.'),
  revenueTotal: z.number().min(0, '매출액은 0 이상이어야 합니다.'),
  visitorCount: z.number().int().min(0, '방문객 수는 0 이상이어야 합니다.'),
  lunchGuestCount: z.number().int().min(0, '점심 인원은 0 이상이어야 합니다.'),
  dinnerGuestCount: z.number().int().min(0, '저녁 인원은 0 이상이어야 합니다.'),
  takeoutCount: z.number().int().min(0, '포장 수량은 0 이상이어야 합니다.'),
  averageWaitMinutes: z.number().int().min(0, '대기시간은 0 이상이어야 합니다.').max(180, '대기시간은 180분 이하로 입력하세요.'),
  stockoutFlag: z.boolean(),
  note: z.string().max(300, '메모는 300자 이하로 입력하세요.').default(''),
});

export type ManualMetricFormInput = z.infer<typeof manualMetricFormSchema>;
