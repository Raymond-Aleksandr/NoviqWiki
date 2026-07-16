"use client";

import { useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { Bold, Heading2, Image, Italic, Link, List, Quote } from "lucide-react";

type Props = {
  name?: string;
  initialValue?: string;
};

export function MarkdownEditor({ name = "markdown", initialValue = "" }: Props) {
  const [value, setValue] = useState(initialValue);
  const extensions = useMemo(() => [markdown()], []);

  function insert(before: string, after = "", sample = "") {
    setValue(
      (current) =>
        `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}${before}${sample}${after}`
    );
  }

  return (
    <div className="panel">
      <div className="article-tabs" role="toolbar" aria-label="Markdown formatting">
        <button type="button" onClick={() => insert("**", "**", "bold")}>
          <Bold size={16} aria-hidden="true" />
          <span className="sr-only">Bold</span>
        </button>
        <button type="button" onClick={() => insert("*", "*", "italic")}>
          <Italic size={16} aria-hidden="true" />
          <span className="sr-only">Italic</span>
        </button>
        <button type="button" onClick={() => insert("## ", "", "Heading")}>
          <Heading2 size={16} aria-hidden="true" />
          <span className="sr-only">Heading</span>
        </button>
        <button type="button" onClick={() => insert("- ", "", "List item")}>
          <List size={16} aria-hidden="true" />
          <span className="sr-only">List</span>
        </button>
        <button type="button" onClick={() => insert("> ", "", "Quote")}>
          <Quote size={16} aria-hidden="true" />
          <span className="sr-only">Quote</span>
        </button>
        <button type="button" onClick={() => insert("[", "](https://example.com)", "link")}>
          <Link size={16} aria-hidden="true" />
          <span className="sr-only">Link</span>
        </button>
        <button type="button" onClick={() => insert("![", "](/media/example.png)", "alt text")}>
          <Image size={16} aria-hidden="true" />
          <span className="sr-only">Image</span>
        </button>
      </div>
      <CodeMirror
        value={value}
        minHeight="30rem"
        extensions={extensions}
        basicSetup={{ lineNumbers: true, foldGutter: true }}
        onChange={setValue}
        aria-label="Markdown editor"
      />
      <textarea name={name} value={value} readOnly hidden />
    </div>
  );
}
