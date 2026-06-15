import { handlePlatformAdminRequest, type PlatformAdminRequestLike } from '../src/server/platformAdminApi.js';
import {
  handleAdminCustomerDetailRequest,
  handleAdminCustomersRequest,
  handleAdminInquiriesRequest,
  type CustomerMemoryRequestLike,
} from '../src/server/mybiz/services/customerMemoryApi.js';
import { handleAdminAiTracesRequest } from '../src/server/mybiz/services/aiTraceApi.js';
import { handleAdminCustomerMemoryInboxRequest } from '../src/server/mybiz/services/customerMemoryInboxApi.js';
import { handleAdminFeedbackRecordsRequest } from '../src/server/mybiz/services/feedbackRecordService.js';
import { handleAdminPublicPageEventsRequest } from '../src/server/mybiz/services/publicPageEventService.js';
import { handleAdminStoreDailySummaryJobsRequest } from '../src/server/mybiz/services/storeDailySummaryJobService.js';
import { sendNodeResponse, type NodeResponseLike } from '../src/server/nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

function getResource(request: PlatformAdminRequestLike) {
  const rawUrl = typeof request.url === 'string' && request.url.trim() ? request.url : '/';

  try {
    const url = new URL(rawUrl, 'https://mybiz.ai.kr');
    return url.searchParams.get('resource')?.trim() || '';
  } catch {
    return '';
  }
}

async function routeAdminRequest(request: PlatformAdminRequestLike & CustomerMemoryRequestLike) {
  switch (getResource(request)) {
    case 'customers':
      return handleAdminCustomersRequest(request);
    case 'customer-detail':
      return handleAdminCustomerDetailRequest(request);
    case 'inquiries':
      return handleAdminInquiriesRequest(request);
    case 'customer-memory-inbox':
      return handleAdminCustomerMemoryInboxRequest(request);
    case 'ai-traces':
      return handleAdminAiTracesRequest(request);
    case 'public-page-events':
    case 'public-page-funnel':
      return handleAdminPublicPageEventsRequest(request);
    case 'feedback-records':
    case 'feedback-summary':
      return handleAdminFeedbackRecordsRequest(request);
    case 'background-jobs':
    case 'daily-store-summary':
      return handleAdminStoreDailySummaryJobsRequest(request);
    default:
      return handlePlatformAdminRequest(request);
  }
}

export default async function handler(request: PlatformAdminRequestLike, response?: NodeResponseLike) {
  const result = await routeAdminRequest(request as PlatformAdminRequestLike & CustomerMemoryRequestLike);
  await sendNodeResponse(result, response);
  return result;
}
