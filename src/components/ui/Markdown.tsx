import { markdownBlocks } from "@/lib/markdown";
import { cn } from "@/lib/cn";

/** Enunciado em Markdown simples (ver src/lib/markdown.ts), sem HTML cru. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn("space-y-3 break-words text-body", className)}>
      {markdownBlocks(source).map((block, i) =>
        block.type === "code" ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-field bg-page p-3 font-mono text-[0.875rem] text-fg"
          >
            <code>{block.text}</code>
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {block.parts.map((part, j) =>
              part.code ? (
                <code
                  key={j}
                  className="rounded bg-page px-1 py-0.5 font-mono text-[0.875em]"
                >
                  {part.text}
                </code>
              ) : (
                part.text
              ),
            )}
          </p>
        ),
      )}
    </div>
  );
}
