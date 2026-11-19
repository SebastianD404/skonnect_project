import { Bot, Database, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ConnectionState = "Connected" | "Configured" | "Unavailable" | "Not configured";

async function getSupabaseStatus(): Promise<ConnectionState> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  brand,
}: {
  title: string;
  description: string;
  status: ConnectionState;
  icon: typeof Bot;
  brand?: "gemini" | "supabase";
}) {
  const ready = status === "Connected" || status === "Configured";

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
              brand === "gemini"
                ? "bg-gradient-to-br from-blue-50 via-violet-50 to-amber-50"
                : brand === "supabase"
                  ? "bg-slate-900"
                  : "bg-[#E8F4F7] text-[#0F3D5C]"
            }`}
          >
            {brand === "gemini" ? (
              <GeminiMark />
            ) : (
              <Icon
                className={`h-4 w-4 ${
                  brand === "supabase" ? "text-[#3ECF8E]" : ""
                }`}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold ${ready ? "text-emerald-700" : "text-rose-700"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-rose-500"}`} />
          {status}
        </span>
      </div>
    </section>
  );
}

function GeminiMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <defs>
        <linearGradient id="gemini-integration-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="32%" stopColor="#9B72CB" />
          <stop offset="58%" stopColor="#D96570" />
          <stop offset="78%" stopColor="#F4AF37" />
          <stop offset="100%" stopColor="#34A853" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C13.2 7.7 16.3 10.8 22 12C16.3 13.2 13.2 16.3 12 22C10.8 16.3 7.7 13.2 2 12C7.7 10.8 10.8 7.7 12 2Z"
        fill="url(#gemini-integration-gradient)"
      />
    </svg>
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
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 sm:gap-8">
      <header>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          System Admin / API Integrations
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">API Integrations</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Monitor real-time connectivity and status for external AI models, authentication services, and system databases.
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-3 md:auto-rows-fr md:grid-cols-2">
        <IntegrationCard
          title="Google Gemini LLM"
          description="API key configuration used for chatbot responses and text embeddings."
          status={geminiStatus}
          icon={Bot}
          brand="gemini"
        />
        <IntegrationCard
          title="Supabase Auth Admin"
          description="Service credentials are checked with a server-side Auth Admin API request."
          status={supabaseStatus}
          icon={ShieldCheck}
          brand="supabase"
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
