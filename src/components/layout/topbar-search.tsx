"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

type TopbarSearchMessages = {
  search: string;
  searchThisWikiPlaceholder: string;
};

export function TopbarSearch({ messages }: { messages: TopbarSearchMessages }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/search")) {
    return <div className="topbar-fill" aria-hidden="true" />;
  }
  return (
    <form action="/search" className="global-search" role="search">
      <label className="sr-only" htmlFor="q">
        {messages.search}
      </label>
      <input id="q" name="q" placeholder={messages.searchThisWikiPlaceholder} />
      <button aria-label={messages.search}>
        <Search size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
