// next-intl request configuration. We do NOT use a `[locale]` segment in the
// app router — locale comes from the `mgwork_lang` cookie or Clerk
// publicMetadata.lang via lib/i18n.ts. This keeps existing routes intact and
// avoids forcing an `/fr/admin` style URL scheme.

import { getRequestConfig } from "next-intl/server";
import { getLocale, messagesFor } from "@/lib/i18n";

export default getRequestConfig(async () => {
  const locale = await getLocale();
  return {
    // next-intl expects lowercase BCP-47 locales — we normalize on read.
    locale: locale.toLowerCase(),
    messages: messagesFor(locale),
  };
});
