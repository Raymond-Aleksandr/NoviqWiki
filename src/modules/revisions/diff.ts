import { createTwoFilesPatch, diffLines } from "diff";

export type DiffLine = {
  type: "context" | "add" | "remove" | "meta";
  text: string;
};

export type SideBySideDiffRow = {
  type: "context" | "add" | "remove" | "change";
  oldLineNumber: number | null;
  newLineNumber: number | null;
  oldText: string;
  newText: string;
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

export function createSideBySideDiff(from: string, to: string): SideBySideDiffRow[] {
  const rows: SideBySideDiffRow[] = [];
  const pendingRemoved: Array<{ lineNumber: number; text: string }> = [];
  let oldLineNumber = 1;
  let newLineNumber = 1;

  function flushRemoved() {
    while (pendingRemoved.length > 0) {
      const removed = pendingRemoved.shift()!;
      rows.push({
        type: "remove",
        oldLineNumber: removed.lineNumber,
        newLineNumber: null,
        oldText: removed.text,
        newText: ""
      });
    }
  }

  for (const part of diffLines(from, to)) {
    const lines = splitDiffLines(part.value);
    if (part.removed) {
      for (const line of lines) {
        pendingRemoved.push({ lineNumber: oldLineNumber, text: line });
        oldLineNumber += 1;
      }
      continue;
    }

    if (part.added) {
      const added = lines.map((line) => {
        const row = { lineNumber: newLineNumber, text: line };
        newLineNumber += 1;
        return row;
      });
      while (pendingRemoved.length > 0 || added.length > 0) {
        const removed = pendingRemoved.shift();
        const nextAdded = added.shift();
        if (removed && nextAdded) {
          rows.push({
            type: "change",
            oldLineNumber: removed.lineNumber,
            newLineNumber: nextAdded.lineNumber,
            oldText: removed.text,
            newText: nextAdded.text
          });
        } else if (removed) {
          rows.push({
            type: "remove",
            oldLineNumber: removed.lineNumber,
            newLineNumber: null,
            oldText: removed.text,
            newText: ""
          });
        } else if (nextAdded) {
          rows.push({
            type: "add",
            oldLineNumber: null,
            newLineNumber: nextAdded.lineNumber,
            oldText: "",
            newText: nextAdded.text
          });
        }
      }
      continue;
    }

    flushRemoved();
    for (const line of lines) {
      rows.push({
        type: "context",
        oldLineNumber,
        newLineNumber,
        oldText: line,
        newText: line
      });
      oldLineNumber += 1;
      newLineNumber += 1;
    }
  }

  flushRemoved();
  return rows;
}

function splitDiffLines(value: string) {
  const lines = value.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines.map((line) => line.replace(/\r$/, ""));
}
