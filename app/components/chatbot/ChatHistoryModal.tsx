"use client";

import { useMemo, useState } from "react";
import type { ChatUiMessage } from "@/app/components/chatbot/hooks/useChatSession";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatUiMessage[];
  onStartNewConversation: () => void;
  onSelectMessage?: (id: string) => void;
};

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString();
}

export function ChatHistoryModal({ isOpen, onClose, messages, onStartNewConversation, onSelectMessage }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ChatUiMessage[]>();
    for (const m of filtered) {
      const label = formatDateLabel(m.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(m);
    }
    return map;
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="w-[720px] max-w-[95%] max-h-[80%] overflow-hidden rounded-xl bg-white shadow-2xl transform transition-all duration-200 ease-out scale-100">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-lg font-semibold">Conversation history</h3>
            <p className="text-xs text-slate-500">Search and revisit past messages</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onStartNewConversation();
                onClose();
              }}
              className="rounded-md bg-[#0F3D5C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0D2E47]"
            >
              Start new conversation
            </button>
            <button onClick={onClose} className="text-sm text-slate-600 hover:underline">
              Close
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-1/3 border-r p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0F3D5C]"
            />

            <div className="mt-3 space-y-2 overflow-auto max-h-[52vh] pr-2">
              {[...grouped.entries()].map(([label, items]) => (
                <div key={label}>
                  <div className="mb-1 text-xs font-semibold text-slate-500">{label}</div>
                  <ul className="space-y-1">
                    {items.map((m) => (
                      <li key={m.id}>
                        <button
                          onClick={() => onSelectMessage?.(m.id)}
                          className="w-full text-left rounded-md px-2 py-2 text-sm hover:bg-slate-50"
                        >
                          <div className="text-xs text-slate-500">{m.role}</div>
                          <div className="truncate font-medium">{m.content}</div>
                          <div className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="w-2/3 p-4">
            <div className="text-sm text-slate-600">Preview</div>
            <div className="mt-3 max-h-[56vh] overflow-auto rounded-md border border-slate-100 p-3">
              {filtered.length === 0 ? (
                <p className="text-sm text-slate-500">No messages match your search.</p>
              ) : (
                filtered.map((m) => (
                  <div key={m.id} className="mb-4">
                    <div className="text-xs text-slate-400">{m.role} — {new Date(m.createdAt).toLocaleString()}</div>
                    <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
