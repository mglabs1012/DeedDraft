"use server";

import { cookies } from "next/headers";
import { z } from "zod";

export async function setLocale(input: unknown) {
  const locale = z.enum(["en", "hi"]).safeParse(input);
  if (!locale.success) return;

  const store = await cookies();
  store.set("deeddraft-locale", locale.data, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
