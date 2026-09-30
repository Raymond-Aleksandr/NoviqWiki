import { AppError } from "@/lib/errors";

export const MAX_MULTIPART_OVERHEAD_BYTES = 256 * 1024;

export async function parseBoundedMediaFormData(request: Request, maxFileBytes: number) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new AppError("A multipart form upload is required.", "unsupported_media_type", 415);
  }

  const maxRequestBytes = maxFileBytes + MAX_MULTIPART_OVERHEAD_BYTES;
  const contentLengthValue = request.headers.get("content-length");
  if (contentLengthValue !== null) {
    const contentLength = Number(contentLengthValue);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new AppError("Content-Length is invalid.", "validation_error", 400);
    }
    if (contentLength > maxRequestBytes) {
      throw uploadTooLarge();
    }
  }

  if (!request.body) {
    throw new AppError("File is required.", "missing_file", 422);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxRequestBytes) {
      throw uploadTooLarge();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new AppError("Multipart form data is invalid.", "validation_error", 422);
  }
}

function uploadTooLarge() {
  return new AppError(
    "Request is larger than the configured upload limit.",
    "upload_too_large",
    413
  );
}
