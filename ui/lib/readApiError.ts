type ApiErrorEnvelope = {
  error?: string | { message?: unknown; code?: unknown };
};

export async function readApiError(
  res: Response,
  fallback?: string,
): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorEnvelope;
    if (typeof body.error === "string") return body.error;
    if (
      body.error &&
      typeof body.error === "object" &&
      typeof body.error.message === "string"
    ) {
      return body.error.message;
    }
  } catch {
    /* ignore */
  }
  return fallback || res.statusText || `HTTP ${res.status}`;
}
