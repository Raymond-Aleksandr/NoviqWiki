import Link from "next/link";
import { compareRevisions, getPageById } from "@/modules/pages/service";

type Props = {
  params: Promise<{ from: string; to: string }>;
};

export default async function DiffPage({ params }: Props) {
  const { from, to } = await params;
  const diff = await compareRevisions({ fromRevisionId: from, toRevisionId: to });
  const page = await getPageById(diff.to.pageId);
  return (
    <section className="panel">
      <h1>
        Compare revision {diff.from.revisionNumber} to {diff.to.revisionNumber}
      </h1>
      <p className="meta">
        {diff.from.editorDisplayName} to {diff.to.editorDisplayName}
      </p>
      <div className="diff" aria-label="Unified diff">
        {diff.lines.map((line, index) => (
          <div
            key={`${index}-${line.text}`}
            className={`diff-line ${
              line.type === "add"
                ? "diff-add"
                : line.type === "remove"
                  ? "diff-remove"
                  : line.type === "meta"
                    ? "diff-meta"
                    : ""
            }`}
          >
            {line.text || " "}
          </div>
        ))}
      </div>
      <p>
        <Link href={`/page/${page.slug}`}>Return to page</Link>
      </p>
    </section>
  );
}
