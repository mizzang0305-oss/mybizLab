export interface NodeResponseLike {
  end?: (body?: string) => unknown;
  json?: (body: unknown) => unknown;
  send?: (body: unknown) => unknown;
  setHeader?: (name: string, value: string | string[]) => unknown;
  status?: (code: number) => NodeResponseLike;
  statusCode?: number;
}

export type MethodRequestLike = Request | { method?: string };

export function getRequestMethod(request: MethodRequestLike) {
  return typeof request.method === 'string' && request.method.trim() ? request.method.toUpperCase() : 'GET';
}

export async function sendNodeResponse(result: Response, response?: NodeResponseLike) {
  if (!response) {
    return;
  }

  if (typeof response.status === 'function') {
    response.status(result.status);
  } else {
    response.statusCode = result.status;
  }

  result.headers.forEach((value, key) => {
    response.setHeader?.(key, value);
  });

  const rawBody = await result.text();
  const contentType = result.headers.get('content-type') || '';

  if (contentType.includes('application/json') && typeof response.json === 'function') {
    const payload = rawBody ? (JSON.parse(rawBody) as unknown) : null;
    response.json(payload);
    return;
  }

  if (typeof response.send === 'function') {
    response.send(rawBody);
    return;
  }

  response.end?.(rawBody);
}
