import { z } from 'zod';

import { createId } from './ids.js';
import type { SurveyQuestion, SurveyQuestionType } from '../types/models.js';

export const SURVEY_QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'rating',
  'revisit_intent',
  'text',
] as const satisfies readonly SurveyQuestionType[];

export const surveyQuestionTypeSchema = z.enum(SURVEY_QUESTION_TYPES);

const surveyOptionSchema = z.string().trim().min(1).max(80);

export const surveyQuestionSchema = z
  .object({
    id: z.string().trim().min(1).default(() => createId('survey_question')),
    label: z.string().trim().min(2).max(120),
    type: surveyQuestionTypeSchema,
    description: z.string().trim().max(180).optional().default(''),
    required: z.boolean().default(true),
    options: z.array(surveyOptionSchema).max(8).optional().default([]),
    sort_order: z.number().int().min(1).default(1),
    placeholder: z.string().trim().max(120).optional().default(''),
  })
  .superRefine((question, context) => {
    if ((question.type === 'single_choice' || question.type === 'multiple_choice') && question.options.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choice questions need at least two options.',
        path: ['options'],
      });
    }
  });

export const surveyFormSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().min(4).max(240),
  is_active: z.boolean().default(true),
  questions: z.array(surveyQuestionSchema).min(1).max(12),
});

export const surveyAnswerSchema = z.object({
  question_id: z.string().trim().min(1),
  value: z.union([z.number(), z.string().trim().min(1), z.array(surveyOptionSchema).min(1)]),
});

export const surveyResponseSchema = z.object({
  survey_id: z.string().trim().min(1),
  customer_name: z.string().trim().min(1).max(60).default('Guest'),
  table_code: z.string().trim().max(24).optional(),
  rating: z.number().min(0).max(5),
  revisit_intent: z.number().min(0).max(100).optional(),
  comment: z.string().trim().max(500).default(''),
  answers: z.array(surveyAnswerSchema).min(1),
});

export function normalizeSurveyQuestions(questions: SurveyQuestion[]) {
  return questions
    .slice()
    .sort((left, right) => (left.sort_order ?? Number.MAX_SAFE_INTEGER) - (right.sort_order ?? Number.MAX_SAFE_INTEGER))
    .map((question, index) =>
      surveyQuestionSchema.parse({
        ...question,
        required: question.required ?? true,
        options: (question.options || []).map((option) => option.trim()).filter(Boolean),
        sort_order: index + 1,
      }),
    );
}

export function createSurveyQuestionDraft(type: SurveyQuestionType, order: number): SurveyQuestion {
  if (type === 'single_choice') {
    return surveyQuestionSchema.parse({
      id: createId('survey_question'),
      label: 'Which option fits best?',
      type,
      required: true,
      options: ['Option 1', 'Option 2'],
      sort_order: order,
    });
  }

  if (type === 'multiple_choice') {
    return surveyQuestionSchema.parse({
      id: createId('survey_question'),
      label: 'Select all that apply',
      type,
      required: false,
      options: ['Option 1', 'Option 2', 'Option 3'],
      sort_order: order,
    });
  }

  if (type === 'rating') {
    return surveyQuestionSchema.parse({
      id: createId('survey_question'),
      label: 'How satisfied were you today?',
      type,
      description: 'Use a five-point score so the owner can compare days quickly.',
      required: true,
      sort_order: order,
    });
  }

  if (type === 'revisit_intent') {
    return surveyQuestionSchema.parse({
      id: createId('survey_question'),
      label: 'Would you visit again?',
      type,
      description: 'This helps the owner track revisit intent without reading every comment.',
      required: true,
      sort_order: order,
    });
  }

  return surveyQuestionSchema.parse({
    id: createId('survey_question'),
    label: 'What should we improve next?',
    type,
    description: 'Use one free-text prompt for concrete suggestions.',
    required: false,
    sort_order: order,
    placeholder: 'Leave a quick comment',
  });
}
