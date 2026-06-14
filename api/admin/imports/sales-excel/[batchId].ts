import { sendNodeResponse, type NodeResponseLike } from '../../../../src/server/nodeResponse.js';
import {
  handleSalesExcelBatchRequest,
  type SalesExcelImportRequestLike,
} from '../../../../src/server/mybiz/services/salesExcelImportApi.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: SalesExcelImportRequestLike, response?: NodeResponseLike) {
  const result = await handleSalesExcelBatchRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
