import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import type { MarkdownCommand } from "./types";

const inlineMarkers = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  link: ["[", "](https://example.com)"]
} as const;

const linePrefixes = { heading: "## ", list: "- ", quote: "> " } as const;

/** Produce a normal CodeMirror transaction so formatting participates in undo and redo. */
export function markdownCommandTransaction(
  state: EditorState,
  command: MarkdownCommand,
  placeholder: string
): TransactionSpec {
  if (command === "bold" || command === "italic" || command === "link") {
    const [before, after] = inlineMarkers[command];
    return {
      ...state.changeByRange((range) => {
        const content = state.sliceDoc(range.from, range.to) || placeholder;
        const from = range.from + before.length;
        const to = from + content.length;
        return {
          changes: { from: range.from, to: range.to, insert: `${before}${content}${after}` },
          range: range.anchor > range.head
            ? EditorSelection.range(to, from)
            : EditorSelection.range(from, to)
        };
      }),
      scrollIntoView: true,
      userEvent: "input.format"
    };
  }

  const prefix = linePrefixes[command];
  const lines = new Map<number, { from: number; insert: string; placeholder: boolean }>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from);
    const lastPosition = !range.empty && state.doc.lineAt(range.to).from === range.to
      ? range.to - 1
      : range.to;
    const last = state.doc.lineAt(lastPosition);
    for (let number = first.number; number <= last.number; number++) {
      const line = state.doc.line(number);
      if (line.text.startsWith(prefix)) continue;
      const usePlaceholder = range.empty && line.length === 0;
      lines.set(line.from, {
        from: line.from,
        insert: `${prefix}${usePlaceholder ? placeholder : ""}`,
        placeholder: usePlaceholder
      });
    }
  }
  const changes = state.changes([...lines.values()].sort((a, b) => a.from - b.from));
  return {
    changes,
    selection: EditorSelection.create(
      state.selection.ranges.map((range) => {
        const line = lines.get(range.from);
        if (range.empty && line?.placeholder) {
          const from = changes.mapPos(range.from, -1) + prefix.length;
          return EditorSelection.range(from, from + placeholder.length);
        }
        return range.map(changes, 1);
      }),
      state.selection.mainIndex
    ),
    scrollIntoView: true,
    userEvent: "input.format"
  };
}
