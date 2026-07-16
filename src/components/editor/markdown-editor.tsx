"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { Bold, Heading2, Image, Italic, Link, List, Quote } from "lucide-react";
import type { Messages } from "@/i18n";

type Props = {
  name?: string;
  initialValue?: string;
  footer?: ReactNode;
  messages: Messages;
};

export function MarkdownEditor({ name = "markdown", initialValue = "", footer, messages }: Props) {
  const [value, setValue] = useState(initialValue);
  const extensions = useMemo(() => [markdown()], []);
  const preview = useMemo(() => renderPreview(value, messages), [messages, value]);

  function insert(before: string, after = "", sample = "") {
    setValue(
      (current) =>
        `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}${before}${sample}${after}`
    );
  }

  return (
    <div className="editor-shell">
      <div className="editor-toolbar" role="toolbar" aria-label={messages.markdownFormatting}>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.bold}
          onClick={() => insert("**", "**", "bold")}
        >
          <Bold size={16} aria-hidden="true" />
          <span className="sr-only">{messages.bold}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.italic}
          onClick={() => insert("*", "*", "italic")}
        >
          <Italic size={16} aria-hidden="true" />
          <span className="sr-only">{messages.italic}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.heading}
          onClick={() => insert("## ", "", messages.heading)}
        >
          <Heading2 size={16} aria-hidden="true" />
          <span className="sr-only">{messages.heading}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.list}
          onClick={() => insert("- ", "", messages.list)}
        >
          <List size={16} aria-hidden="true" />
          <span className="sr-only">{messages.list}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.quote}
          onClick={() => insert("> ", "", messages.quote)}
        >
          <Quote size={16} aria-hidden="true" />
          <span className="sr-only">{messages.quote}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.link}
          onClick={() => insert("[", "](https://example.com)", "link")}
        >
          <Link size={16} aria-hidden="true" />
          <span className="sr-only">{messages.link}</span>
        </button>
        <button
          className="editor-tool-button"
          type="button"
          title={messages.image}
          onClick={() => insert("![", "](/media/example.png)", messages.altText)}
        >
          <Image size={16} aria-hidden="true" />
          <span className="sr-only">{messages.image}</span>
        </button>
      </div>
      <div className="editor-columns">
        <div className="editor-code-pane">
          <CodeMirror
            value={value}
            minHeight="30rem"
            extensions={extensions}
            basicSetup={{ lineNumbers: true, foldGutter: true }}
            onChange={setValue}
            aria-label={messages.markdownEditor}
          />
        </div>
        <div className="editor-preview" aria-label={messages.markdownPreview}>
          <div className="editor-preview-kicker">{messages.livePreview}</div>
          {preview}
        </div>
      </div>
      {footer ? <div className="editor-footer">{footer}</div> : null}
      <textarea name={name} value={value} readOnly hidden />
    </div>
  );
}

function renderPreview(value: string, messages: Messages): ReactNode[] | ReactNode {
  const nodes: ReactNode[] = [];
  let listItems: ReactNode[] = [];

  function flushList() {
    if (listItems.length > 0) {
      nodes.push(<ul key={`list-${nodes.length}`}>{listItems}</ul>);
      listItems = [];
    }
  }

  value.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      nodes.push(<h2 key={index}>{renderInline(trimmed.slice(2))}</h2>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      nodes.push(<h3 key={index}>{renderInline(trimmed.slice(3))}</h3>);
      return;
    }
    if (trimmed.startsWith("- ")) {
      listItems.push(<li key={index}>{renderInline(trimmed.slice(2))}</li>);
      return;
    }
    if (trimmed.startsWith("> ")) {
      flushList();
      nodes.push(<blockquote key={index}>{renderInline(trimmed.slice(2))}</blockquote>);
      return;
    }
    if (trimmed.startsWith("[[Category:")) {
      flushList();
      nodes.push(
        <p key={index}>
          <span className="badge">
            {trimmed.replace(/^\[\[Category:/, "").replace(/\]\]$/, "")}
          </span>
        </p>
      );
      return;
    }
    flushList();
    nodes.push(<p key={index}>{renderInline(trimmed)}</p>);
  });

  flushList();
  return nodes.length > 0 ? nodes : <p className="muted">{messages.previewEmpty}</p>;
}

function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\])/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index}>{part.slice(1, -1)}</code>;
      }
      if (part.startsWith("[[") && part.endsWith("]]")) {
        const [target, label] = part.slice(2, -2).split("|");
        return (
          <span className="badge danger" key={index}>
            {label ?? target}
          </span>
        );
      }
      return part;
    });
}
