"use client";

import { Fragment } from "react";

type Props = {
  content: string;
};

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`b-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`t-${index}`}>{part}</Fragment>;
  });
}

export function MarkdownLite({ content }: Props) {
  const lines = content.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const current = lines[index]?.trimEnd() ?? "";

    if (!current.trim()) {
      index += 1;
      continue;
    }

    const bulletMatch = current.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const line = lines[index]?.trimEnd() ?? "";
        const match = line.match(/^[-*•]\s+(.+)/);
        if (!match) {
          break;
        }
        items.push(match[1]);
        index += 1;
      }

      nodes.push(
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`li-${itemIndex}`}>{renderInlineBold(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    const paragraphLines: string[] = [current];
    index += 1;

    while (index < lines.length) {
      const next = lines[index]?.trimEnd() ?? "";
      if (!next.trim() || /^[-*•]\s+(.+)/.test(next)) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }

    nodes.push(
      <p key={`p-${index}`} className="leading-relaxed">
        {paragraphLines.map((line, lineIndex) => (
          <Fragment key={`line-${lineIndex}`}>
            {lineIndex > 0 ? <br /> : null}
            {renderInlineBold(line)}
          </Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-2 text-sm text-slate-700">{nodes}</div>;
}
