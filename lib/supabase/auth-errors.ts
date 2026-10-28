type NormalizedAuthError = {
  code?: string;
  message?: string;
};

function normalizeAuthError(error: unknown): NormalizedAuthError | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const authError = error as { code?: unknown; message?: unknown };
  return {
    code: typeof authError.code === "string" ? authError.code : undefined,
    message: typeof authError.message === "string" ? authError.message : undefined,
  };
}

export function isAuthSessionMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as { name?: unknown; message?: unknown };
  return (
    authError.name === "AuthSessionMissingError" ||
    authError.message === "Auth session missing!"
  );
}

export function isRefreshTokenMissingError(error: unknown): boolean {
  const normalized = normalizeAuthError(error);
  if (!normalized) {
    return false;
  }

  return (
    normalized.code === "refresh_token_not_found" ||
    (normalized.message?.toLowerCase().includes("refresh token") === true &&
      normalized.message.toLowerCase().includes("not found"))
  );
}
