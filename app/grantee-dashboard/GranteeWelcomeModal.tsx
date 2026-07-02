"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, Coins, FileText, Rocket } from "lucide-react";

type Props = {
  isOpen: boolean;
  isSaving: boolean;
  onAcknowledge: () => Promise<void> | void;
};

export default function GranteeWelcomeModal({ isOpen, isSaving, onAcknowledge }: Props) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/30"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to grantee workspace"
        >
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white shadow-[0_20px_50px_rgba(11,25,44,0.08)]"
          >
            <div className="space-y-6 p-8">
              <header className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#0B192C]">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0B192C] text-white">
                    <Rocket className="h-3 w-3" />
                  </span>
                  Grantee Onboarding
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Welcome to your SKonnect Grantee Workspace!
                </h2>
                <p className="text-sm leading-relaxed text-slate-500">
                  Your hard work paid off. Let&apos;s look over your dashboard and responsibilities to keep your status active.
                </p>
              </header>

              <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                <div className="divide-y divide-slate-100">
                  <article className="flex items-start gap-4 p-4 sm:py-5 sm:px-5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-600">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-col space-y-1">
                      <h3 className="text-sm font-semibold tracking-tight text-slate-950">Semestral Document Submissions</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Every semester, upload your <span className="font-medium text-slate-800">Certificate of Enrollment (COE)</span> and <span className="font-medium text-slate-800">Official Grades</span> from the previous term in your submissions panel.
                      </p>
                    </div>
                  </article>

                  <article className="flex items-start gap-4 p-4 sm:py-5 sm:px-5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-amber-200/50 bg-amber-50/70 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-col space-y-1">
                      <h3 className="text-sm font-semibold tracking-tight text-slate-950">Grade Retention Policy</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Maintain a General Weighted Average (GWA) of{" "}
                        <span className="mx-0.5 inline-flex items-center font-mono text-[11px] font-bold text-amber-700">
                          80% or above
                        </span>
                        . Falling below this semestral baseline results in immediate removal from the grant roster.
                      </p>
                    </div>
                  </article>

                  <article className="flex items-start gap-4 p-4 sm:py-5 sm:px-5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-indigo-50/60 text-indigo-600">
                      <Coins className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-col space-y-1">
                      <h3 className="text-sm font-semibold tracking-tight text-slate-950">Mandatory KK Meetings & Payouts</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Attendance at Katipunan ng Kabataan official assemblies is mandatory. <span className="font-medium text-slate-800">Stipend payouts are distributed during these event dates</span>, so missing a meeting means missing your payout window.
                      </p>
                    </div>
                  </article>
                </div>
              </section>

              <footer>
                <button
                  type="button"
                  onClick={onAcknowledge}
                  disabled={isSaving}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B192C] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-[1.01] hover:bg-[#132744] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "I Understand, Open My Dashboard"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </footer>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
