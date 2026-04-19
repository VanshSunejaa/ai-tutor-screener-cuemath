export function Loader({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-600">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-zinc-400 animate-pulse" />
        <span className="h-2 w-2 rounded-full bg-zinc-400 animate-pulse [animation-delay:150ms]" />
        <span className="h-2 w-2 rounded-full bg-zinc-400 animate-pulse [animation-delay:300ms]" />
      </span>
      <span>{label ?? "Working..."}</span>
    </div>
  );
}

