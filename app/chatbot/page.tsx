import Link from "next/link";

export default function ChatbotPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] p-12">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-lg p-10 text-center">
        <h1 className="text-3xl font-black text-[#0F3D5C] mb-4">Multilingual Helpdesk</h1>
        <p className="text-slate-700 mb-6">Ask in English, Filipino, or Ilocano. The helpdesk can answer common questions about scholarships, events, and account issues.</p>

        <div className="border border-slate-200 rounded-xl p-6">
          <p className="text-sm text-slate-600">Chat UI placeholder — integrate your chat provider here.</p>
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm font-semibold text-[#0F3D5C]">← Back home</Link>
        </div>
      </div>
    </div>
  );
}
