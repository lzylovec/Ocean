type ApiErrorPayload = {
  detail?: string | { message?: string; code?: string; retryable?: boolean };
  message?: string;
  code?: string;
};

export async function readApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (!payload) return fallback;

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (
    payload.detail &&
    typeof payload.detail === "object" &&
    typeof payload.detail.message === "string" &&
    payload.detail.message.trim()
  ) {
    return payload.detail.message;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return fallback;
}
