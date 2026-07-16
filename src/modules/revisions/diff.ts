import { createTwoFilesPatch } from "diff";

export type DiffLine = {
  type: "context" | "add" | "remove" | "meta";
  text: string;
};

export function createUnifiedDiff(from: string, to: string, fromLabel = "from", toLabel = "to") {
  return createTwoFilesPatch(fromLabel, toLabel, from, to, "", "", { context: 3 });
}

export function parseUnifiedDiff(diff: string): DiffLine[] {
  return diff.split("\n").map((line) => {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
      return { type: "meta", text: line };
    }
    if (line.startsWith("+")) {
      return { type: "add", text: line };
    }
    if (line.startsWith("-")) {
      return { type: "remove", text: line };
    }
    return { type: "context", text: line };
  });
}
