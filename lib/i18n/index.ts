import { cookies } from "next/headers";

import { en } from "./en";
import { hi } from "./hi";

export type Locale = "en" | "hi";

const dictionaries = { en, hi } as const;

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get("deeddraft-locale")?.value === "hi" ? "hi" : "en";
}

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
