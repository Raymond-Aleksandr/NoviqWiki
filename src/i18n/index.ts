import { en } from "./en";
import { zhCN } from "./zh-CN";

const dictionaries = {
  en,
  "zh-CN": zhCN
};

export type Locale = keyof typeof dictionaries;
export type Messages = typeof en;

export function getMessages(locale?: string): Messages {
  if (locale === "zh-CN") {
    return dictionaries["zh-CN"];
  }
  return dictionaries.en;
}
