"use client";

export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
      <span className="ml-1">Thinking...</span>
    </div>
  );
}
