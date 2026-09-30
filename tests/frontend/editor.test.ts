import assert from "node:assert/strict";
import test from "node:test";
import { EditorSelection, EditorState } from "@codemirror/state";
import { markdownCommandTransaction } from "../../src/features/editor/commands";
import { createPreviewController } from "../../src/features/editor/preview-controller";
import type { PreviewState } from "../../src/features/editor/types";

function state(doc: string, anchor: number, head = anchor) {
  return EditorState.create({ doc, selection: { anchor, head } });
}

test("inline formatting surrounds the selection and preserves its direction", () => {
  for (const [anchor, head] of [[0, 5], [5, 0]]) {
    const before = state("hello world", anchor, head);
    const after = before.update(markdownCommandTransaction(before, "bold", "Bold")).state;
    assert.equal(after.doc.toString(), "**hello** world");
    assert.equal(after.sliceDoc(after.selection.main.from, after.selection.main.to), "hello");
    assert.equal(after.selection.main.anchor > after.selection.main.head, anchor > head);
  }
});

test("formatting inserts a selected placeholder at the cursor instead of appending", () => {
  const before = state("hello world", 6);
  const after = before.update(markdownCommandTransaction(before, "italic", "Italic")).state;
  assert.equal(after.doc.toString(), "hello *Italic*world");
  assert.equal(after.sliceDoc(after.selection.main.from, after.selection.main.to), "Italic");
});

test("block formatting changes only selected lines, excluding an unselected boundary line", () => {
  const before = state("one\ntwo\nthree", 0, 8);
  const after = before.update(markdownCommandTransaction(before, "heading", "Heading")).state;
  assert.equal(after.doc.toString(), "## one\n## two\nthree");
  assert.equal(after.selection.main.from, 3);
  assert.equal(after.selection.main.to, 14);
});

test("block formatting operates on the cursor's line and selects empty-line placeholders", () => {
  const before = state("one\ntwo", 6);
  const after = before.update(markdownCommandTransaction(before, "list", "List")).state;
  assert.equal(after.doc.toString(), "one\n- two");
  assert.equal(after.selection.main.head, 8);
  const empty = state("", 0);
  const quoted = empty.update(markdownCommandTransaction(empty, "quote", "Quote")).state;
  assert.equal(quoted.doc.toString(), "> Quote");
  assert.equal(quoted.sliceDoc(quoted.selection.main.from, quoted.selection.main.to), "Quote");
});

test("block formatting preserves reversed selection and avoids duplicating an existing prefix", () => {
  const before = state("> one\ntwo", 9, 0);
  const after = before.update(markdownCommandTransaction(before, "quote", "Quote")).state;
  assert.equal(after.doc.toString(), "> one\n> two");
  assert.equal(after.selection.main.anchor > after.selection.main.head, true);
  const again = after.update(markdownCommandTransaction(after, "quote", "Quote")).state;
  assert.equal(again.doc.toString(), after.doc.toString());
});

test("multiple selections are formatted independently in one transaction", () => {
  const before = EditorState.create({
    doc: "one two",
    selection: EditorSelection.create([EditorSelection.range(0, 3), EditorSelection.range(4, 7)]),
    extensions: EditorState.allowMultipleSelections.of(true)
  });
  const after = before.update(markdownCommandTransaction(before, "bold", "Bold")).state;
  assert.equal(after.doc.toString(), "**one** **two**");
  assert.deepEqual(after.selection.ranges.map((range) => after.sliceDoc(range.from, range.to)), ["one", "two"]);
});

function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

const passDebounce = () => new Promise((resolve) => setTimeout(resolve, 5));
const flushPromises = async () => { await Promise.resolve(); await Promise.resolve(); };

test("preview requests debounce and reject stale results even if transport ignores abort", async () => {
  const updates: PreviewState[] = [];
  const requests: Array<{ value: string; signal: AbortSignal; result: ReturnType<typeof deferred> }> = [];
  const controller = createPreviewController({
    initial: { value: "initial", html: "<p>initial</p>", mode: "edit" },
    delay: 0,
    onChange: (update) => updates.push(update),
    request: (value, _mode, signal) => {
      const result = deferred();
      requests.push({ value, signal, result });
      return result.promise;
    }
  });
  controller.update("discarded before request", "edit");
  controller.update("first", "edit");
  await passDebounce();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].value, "first");
  controller.update("latest", "edit");
  await passDebounce();
  assert.equal(requests[0].signal.aborted, true);
  requests[1].result.resolve("<p>latest</p>");
  await flushPromises();
  requests[0].result.resolve("<p>stale</p>");
  await flushPromises();
  assert.deepEqual(updates.at(-1), { html: "<p>latest</p>", status: "ready" });
  controller.dispose();
});

test("reverting Markdown restores matching cached HTML and cancels in-flight work", async () => {
  const updates: PreviewState[] = [];
  const result = deferred();
  let signal: AbortSignal | undefined;
  const controller = createPreviewController({
    initial: { value: "initial", html: "<p>initial</p>", mode: "create" },
    delay: 0,
    onChange: (update) => updates.push(update),
    request: (_value, _mode, nextSignal) => { signal = nextSignal; return result.promise; }
  });
  controller.update("changed", "create");
  await passDebounce();
  controller.update("initial", "create");
  assert.equal(signal?.aborted, true);
  assert.deepEqual(updates.at(-1), { html: "<p>initial</p>", status: "ready" });
  result.resolve("<p>changed</p>");
  await flushPromises();
  assert.deepEqual(updates.at(-1), { html: "<p>initial</p>", status: "ready" });
  controller.dispose();
});

test("preview errors retain the last HTML and disposal suppresses later updates", async () => {
  const updates: PreviewState[] = [];
  const results = [deferred(), deferred()];
  let count = 0;
  const controller = createPreviewController({
    initial: { value: "initial", html: "<p>initial</p>", mode: "edit" },
    delay: 0,
    onChange: (update) => updates.push(update),
    request: () => results[count++].promise
  });
  controller.update("changed", "edit");
  await passDebounce();
  results[0].reject(new Error("Preview failed"));
  await flushPromises();
  assert.deepEqual(updates.at(-1), { html: "<p>initial</p>", status: "error" });
  controller.update("later", "edit");
  await passDebounce();
  controller.dispose();
  const length = updates.length;
  results[1].resolve("<p>too late</p>");
  await flushPromises();
  controller.update("after disposal", "edit");
  assert.equal(updates.length, length);
});

test("preview permissions mode is part of the cache key", async () => {
  const updates: PreviewState[] = [];
  const result = deferred();
  const requests: string[] = [];
  const controller = createPreviewController({
    initial: { value: "same Markdown", html: "<p>initial</p>", mode: "edit" },
    delay: 0,
    onChange: (update) => updates.push(update),
    request: (_value, mode) => { requests.push(mode); return result.promise; }
  });
  controller.update("same Markdown", "create");
  await passDebounce();
  assert.deepEqual(requests, ["create"]);
  result.resolve("<p>create preview</p>");
  await flushPromises();
  assert.deepEqual(updates.at(-1), { html: "<p>create preview</p>", status: "ready" });
  controller.dispose();
});
