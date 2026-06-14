import { sendNodeResponse, type NodeResponseLike } from '../../../../src/server/nodeResponse.js';
import {
  handleSalesExcelPreviewRequest,
  type SalesExcelImportRequestLike,
} from '../../../../src/server/mybiz/services/salesExcelImportApi.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: SalesExcelImportRequestLike, response?: NodeResponseLike) {
  const result = await handleSalesExcelPreviewRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
