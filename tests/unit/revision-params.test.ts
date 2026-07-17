import { describe, expect, it } from "vitest";
import { invalidRevisionNumber, parseRevisionNumberParam } from "@/modules/revisions/params";

describe("revision URL parameters", () => {
  it("accepts positive integer revision numbers only", () => {
    expect(parseRevisionNumberParam(undefined)).toBeNull();
    expect(parseRevisionNumberParam("1")).toBe(1);
    expect(parseRevisionNumberParam("12")).toBe(12);

    expect(parseRevisionNumberParam("")).toBe(invalidRevisionNumber);
    expect(parseRevisionNumberParam("0")).toBe(invalidRevisionNumber);
    expect(parseRevisionNumberParam("-1")).toBe(invalidRevisionNumber);
    expect(parseRevisionNumberParam("1.5")).toBe(invalidRevisionNumber);
    expect(parseRevisionNumberParam("abc")).toBe(invalidRevisionNumber);
    expect(parseRevisionNumberParam("9007199254740992")).toBe(invalidRevisionNumber);
  });
});
