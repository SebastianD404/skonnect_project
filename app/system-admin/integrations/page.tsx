import { Bot, Database, KeyRound, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ConnectionState = "Connected" | "Configured" | "Unavailable" | "Not configured";

async function getSupabaseStatus(): Promise<ConnectionState> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return "Not configured";

  try {
    const { error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1 });
    return error ? "Unavailable" : "Connected";
  } catch {
    return "Unavailable";
  }
}

async function getPgVectorStatus(): Promise<ConnectionState> {
  try {
    const rows = await prisma.$queryRaw<Array<{ enabled: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) AS enabled
    `;
    return rows[0]?.enabled ? "Connected" : "Unavailable";
  } catch {
    return "Unavailable";
  }
}

function IntegrationCard({
  title,
  description,
  status,
  icon: Icon,
}: {
  title: string;
  description: string;
  status: ConnectionState;
  icon: typeof Bot;
}) {
  const ready = status === "Connected" || status === "Configured";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${ready ? "text-emerald-700" : "text-rose-700"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-rose-500"}`} />
          {status}
        </span>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
        Credential source: deployment environment
      </div>
    </section>
  );
}

export default async function SystemAdminIntegrationsPage() {
  const geminiStatus: ConnectionState = process.env.GOOGLE_GEMINI_API_KEY?.trim()
    ? "Configured"
    : "Not configured";
  const [supabaseStatus, pgVectorStatus] = await Promise.all([
    getSupabaseStatus(),
    getPgVectorStatus(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          System Admin / API Integrations
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">API Integrations</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Connection status for AI services, Supabase Auth, and the vector database. Secret values are not exposed in this workspace.
        </p>
      </header>

      <div role="note" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p>
          Credentials are deployment-managed. Update environment variables in the deployment platform; this page only reports configuration and connection status.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IntegrationCard
          title="Google Gemini LLM"
          description="API key configuration used for chatbot responses and text embeddings."
          status={geminiStatus}
          icon={Bot}
        />
        <IntegrationCard
          title="Supabase Auth Admin"
          description="Service credentials are checked with a server-side Auth Admin API request."
          status={supabaseStatus}
          icon={ShieldCheck}
        />
        <IntegrationCard
          title="PostgreSQL + pgvector"
          description="Database connectivity and vector extension availability for retrieval."
          status={pgVectorStatus}
          icon={Database}
        />
      </div>
    </div>
  );
}
