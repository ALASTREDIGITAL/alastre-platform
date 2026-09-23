import { headers } from "next/headers";
import { AppShell } from "./app-shell";

export const dynamic = "force-dynamic";

export default async function Home(props: {
  searchParams?: Promise<{ view?: string | string[] }>;
}) {
  const resolvedSearchParams = props.searchParams ? await props.searchParams : undefined;
  const initialView =
    typeof resolvedSearchParams?.view === "string"
      ? resolvedSearchParams.view
      : Array.isArray(resolvedSearchParams?.view)
      ? resolvedSearchParams.view[0]
      : undefined;

  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const encoding = requestHeaders.get("oai-authenticated-user-full-name-encoding");
  const fullName = encodedName && encoding === "percent-encoded-utf-8"
    ? decodeURIComponent(encodedName)
    : null;

  return <AppShell userName={fullName ?? email ?? "Equipe Alastre"} initialView={initialView} />;
}
