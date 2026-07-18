// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { en } from "@/i18n/en";

vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
    "aria-label": ariaLabel
  }: {
    value: string;
    onChange: (value: string) => void;
    "aria-label"?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}));

vi.mock("@codemirror/lang-markdown", () => ({ markdown: () => [] }));

describe("MarkdownEditor preview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the server-provided preview and toggles the expanded layout", () => {
    render(
      <MarkdownEditor
        initialValue="![Example](https://example.com/image.png)"
        initialPreviewHtml={'<p><img src="https://example.com/image.png" alt="Example"></p>'}
        previewMode="edit"
        messages={en}
      />
    );

    expect(screen.getByRole("img", { name: "Example" }).getAttribute("src")).toBe(
      "https://example.com/image.png"
    );
    const toggle = screen.getByRole("button", { name: en.expandPreview });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.closest(".editor-shell")?.classList.contains("preview-expanded")).toBe(true);
  });

  it("debounces preview requests and ignores an older response", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MarkdownEditor
        initialValue="Initial"
        initialPreviewHtml="<p>Initial preview</p>"
        previewMode="edit"
        messages={en}
      />
    );

    const editor = screen.getByLabelText(en.markdownEditor);
    fireEvent.change(editor, { target: { value: "First" } });
    await act(async () => {
      vi.advanceTimersByTime(249);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(editor, { target: { value: "Second" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve(previewResponse("<p>Second preview</p>"));
    });
    expect(screen.getByText("Second preview")).not.toBeNull();

    await act(async () => {
      first.resolve(previewResponse("<p>First preview</p>"));
    });
    expect(screen.queryByText("First preview")).toBeNull();
    expect(screen.getByText("Second preview")).not.toBeNull();
  });

  it("returns to the last rendered preview while an update is pending", async () => {
    const pending = deferredResponse();
    const fetchMock = vi.fn().mockReturnValueOnce(pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MarkdownEditor
        initialValue="Initial"
        initialPreviewHtml="<p>Initial preview</p>"
        previewMode="edit"
        messages={en}
      />
    );

    const editor = screen.getByLabelText(en.markdownEditor);
    fireEvent.change(editor, { target: { value: "Pending" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText(en.previewUpdating)).not.toBeNull();

    fireEvent.change(editor, { target: { value: "Initial" } });
    expect(screen.queryByText(en.previewUpdating)).toBeNull();
    await act(async () => {
      pending.resolve(previewResponse("<p>Outdated preview</p>"));
    });
    expect(screen.queryByText("Outdated preview")).toBeNull();
    expect(screen.getByText("Initial preview")).not.toBeNull();
  });
});

function previewResponse(html: string) {
  return {
    ok: true,
    json: async () => ({ data: { html } })
  };
}

function deferredResponse() {
  let resolve!: (value: ReturnType<typeof previewResponse>) => void;
  const promise = new Promise<ReturnType<typeof previewResponse>>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
