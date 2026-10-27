import { NextResponse } from "next/server";

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isDatabaseConnectionError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  if (
    code === "P2039" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P2024" ||
    code === "P2037" ||
    code?.startsWith("08")
  ) {
    return true;
  }

  if (
    message.includes("eauthtimeout") ||
    message.includes("timeout while waiting for message") ||
    message.includes("connection terminated unexpectedly")
  ) {
    return true;
  }

  const meta = (error as { meta?: { driverAdapterError?: unknown } } | null)?.meta;
  return meta?.driverAdapterError
    ? isDatabaseConnectionError(meta.driverAdapterError)
    : false;
}

export function databaseUnavailableResponse(error: unknown, route: string) {
  if (!isDatabaseConnectionError(error)) return null;

  console.error(`${route}: database connection unavailable`, {
    code: getErrorCode(error),
    message: getErrorMessage(error),
  });

  return NextResponse.json(
    { error: "The service is temporarily unavailable. Please try again shortly." },
    { status: 503, headers: { "Retry-After": "5" } }
  );
}
