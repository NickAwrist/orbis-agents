export function ProviderSetupBanner({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  return (
    <aside
      className="ui-animate-fade-in fixed inset-x-0 top-0 z-[60] flex h-9 items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-950/55 px-4 text-center text-[0.75rem] font-medium leading-none text-amber-100/95 backdrop-blur-md backdrop-saturate-150 [box-shadow:inset_0_-1px_0_0_rgba(255,255,255,0.04)]"
      aria-live="polite"
    >
      <span>No model provider is ready.</span>
      <button
        type="button"
        onClick={onOpenSettings}
        className="rounded px-1.5 py-1 text-amber-100 underline decoration-amber-300/60 underline-offset-2 transition-colors hover:bg-amber-400/10 hover:text-white"
      >
        Set one up in Settings
      </button>
    </aside>
  );
}
