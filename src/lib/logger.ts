import pino from "pino";

export const logger = pino({
  level: process.env.NEXTWIKI_LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "tokenHash",
      "session",
      "cookie",
      "headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token"
    ],
    censor: "[redacted]"
  }
});
