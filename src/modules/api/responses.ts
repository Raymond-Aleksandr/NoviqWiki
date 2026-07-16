import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, toPublicError } from "@/lib/errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function empty(status = 204) {
  return new NextResponse(null, { status });
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "The request is invalid.",
          details: error.flatten()
        }
      },
      { status: 422 }
    );
  }
  if (error instanceof AppError) {
    const publicError = toPublicError(error);
    return NextResponse.json(publicError.body, { status: publicError.status });
  }
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred."
      }
    },
    { status: 500 }
  );
}

export function requestId() {
  return crypto.randomUUID();
}
