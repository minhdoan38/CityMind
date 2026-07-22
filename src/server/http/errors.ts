export const CITIZEN_STATUS_UNAUTHORIZED_DETAIL =
  "We could not verify that report and token.";

export class HttpError extends Error {
  readonly status: number;
  readonly headers?: Record<string, string>;

  constructor(status: number, message: string, headers?: Record<string, string>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.headers = headers;
  }
}

export function citizenStatusUnauthorized(): HttpError {
  return new HttpError(401, CITIZEN_STATUS_UNAUTHORIZED_DETAIL);
}

export function jsonErrorResponse(error: HttpError): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (error.headers) {
    for (const [key, value] of Object.entries(error.headers)) {
      headers.set(key, value);
    }
  }
  return Response.json({ detail: error.message }, { status: error.status, headers });
}

export function genericServiceFailure(message = "Status lookup failed"): HttpError {
  return new HttpError(502, message);
}

export function reportAnalysisFailed(): HttpError {
  return new HttpError(502, "Report analysis failed");
}

export function reportSubmissionFailed(): HttpError {
  return new HttpError(502, "Report submission failed");
}

export const ANALYZE_ROUTE_GONE_DETAIL =
  "POST /api/public/reports/analyze is removed. Use POST /api/public/reports for intake.";

export function analyzeRouteGone(): HttpError {
  return new HttpError(410, ANALYZE_ROUTE_GONE_DETAIL);
}

export function imageTooLarge(): HttpError {
  return new HttpError(413, "Image exceeds configured size limit");
}

export function unsupportedImageType(received = "unknown"): HttpError {
  return new HttpError(
    415,
    `Only JPEG, PNG, or WebP images are accepted. Received: ${received}`,
  );
}
