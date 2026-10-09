import DocumentViewerClient from "../../DocumentViewerClient";

interface DocumentPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}

export default async function DocumentPage({ params, searchParams }: DocumentPageProps) {
  const [{ id }, { kind }] = await Promise.all([params, searchParams]);
  if (kind !== "coe" && kind !== "grade") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm font-medium text-slate-600">Invalid document selection.</p>
      </main>
    );
  }
  const documentKind = kind === "grade" ? "grade" : "coe";

  return <DocumentViewerClient submissionId={id} kind={documentKind} />;
}
