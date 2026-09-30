import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, actions }: Props) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow ? <p className="page-header-eyebrow eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <div className="page-header-description">{description}</div> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
