export const invalidRevisionNumber = Symbol("invalidRevisionNumber");

export type ParsedRevisionNumber = number | null | typeof invalidRevisionNumber;

export function parseRevisionNumberParam(value: string | undefined): ParsedRevisionNumber {
  if (value === undefined) {
    return null;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    return invalidRevisionNumber;
  }
  const revisionNumber = Number(value);
  return Number.isSafeInteger(revisionNumber) ? revisionNumber : invalidRevisionNumber;
}
