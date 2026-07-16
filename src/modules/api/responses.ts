import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, toPublicError } from "@/lib/errors";
import { localizeAppError } from "@/i18n/errors";
import { getRequestI18n } from "@/i18n/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function empty(status = 204) {
  return new NextResponse(null, { status });
}

export async function apiError(error: unknown) {
  const { messages } = await getRequestI18n();
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: messages.requestInvalid,
          details: error.flatten()
        }
      },
      { status: 422 }
    );
  }
  if (error instanceof AppError) {
    const publicError = toPublicError(error);
    publicError.body.error.message = localizeAppError(error, messages);
    return NextResponse.json(publicError.body, { status: publicError.status });
  }
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: messages.unexpectedError
      }
    },
    { status: 500 }
  );
}

export function requestId() {
  return crypto.randomUUID();
}
