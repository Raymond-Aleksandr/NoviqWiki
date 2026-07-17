import type { Messages } from "@/i18n";

export function formatRevisionSummary(summary: string, messages: Messages) {
  const trimmed = summary.trim();
  if (!trimmed) {
    return "";
  }

  const rollbackMatch =
    trimmed.match(/^rollback (?:from diff )?to revision (\d+)$/i) ??
    trimmed.match(/^rollback r(\d+)$/i) ??
    trimmed.match(/^roll back to r(\d+)$/i);
  if (rollbackMatch) {
    return formatRollbackRevisionSummary(messages, Number(rollbackMatch[1]));
  }

  if (/^initial publication$/i.test(trimmed) || /^initial publish$/i.test(trimmed)) {
    return messages.initialPublicationSummary;
  }

  if (/^update body$/i.test(trimmed)) {
    return messages.updateBodySummary;
  }

  return trimmed;
}

export function formatRollbackRevisionSummary(messages: Messages, revisionNumber: number) {
  return messages.rollbackRevisionSummary.replace("{revision}", String(revisionNumber));
}
