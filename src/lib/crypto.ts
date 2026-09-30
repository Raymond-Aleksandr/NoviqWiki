import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAppSecret } from "@/lib/env";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string) {
  return createHmac("sha256", getAppSecret()).update(value).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export function contentHash(markdown: string) {
  return sha256(markdown.normalize("NFC"));
}

export function redactSecret(value: string | undefined | null) {
  if (!value) {
    return "";
  }
  if (value.length <= 8) {
    return "[redacted]";
  }
  return `${value.slice(0, 4)}...[redacted]...${value.slice(-4)}`;
}
