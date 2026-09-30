export type ArticlePageSummary = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived" | "deleted";
  protected: boolean;
};

export type RevisionSummary = {
  id: string;
  revisionNumber: number;
  editSummary: string;
  editorDisplayName: string;
  createdAt: Date;
};

export type ArticleHeading = {
  id: string;
  depth: number;
  text: string;
};

export type ArticleRevision = Pick<
  RevisionSummary,
  "revisionNumber" | "editorDisplayName" | "createdAt"
> & {
  html: string;
  headings: ArticleHeading[];
  characterCount: number;
};

export type ArticleCategory = { name: string; slug: string };

export type ArticleStatistics = {
  outboundCount: number;
  backlinkCount: number;
  revisionCount: number;
};

export type ArticlePermissions = {
  canEdit: boolean;
  canWatch: boolean;
  watched: boolean;
};

export type RevisionHistoryPage = {
  id: string;
  slug: string;
  currentRevisionId: string | null;
};

export type RevisionOption = { id: string; label: string };
