export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, "forbidden", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message, "not_found", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "The resource changed before this request was applied.") {
    super(message, "conflict", 409);
  }
}

export class ValidationError extends AppError {
  constructor(details: Record<string, unknown>) {
    super("The request is invalid.", "validation_error", 422, details);
  }
}

export function toPublicError(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      }
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred."
      }
    }
  };
}
