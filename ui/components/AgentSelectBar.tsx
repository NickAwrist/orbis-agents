import { Bot, ChevronDown } from "lucide-react";

const selectClass =
  "w-full max-w-[14rem] cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent py-1 pl-8 pr-7 text-[0.8125rem] font-medium text-muted-foreground outline-none transition-[border-color,background-color,color] duration-150 hover:bg-muted/60 focus-visible:border-border focus-visible:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-45";

export function AgentSelectBar({
  agents,
  selectedAgent,
  onAgentChange,
  disabled,
}: {
  agents: { name: string }[];
  selectedAgent: string;
  onAgentChange: (name: string) => void;
  disabled: boolean;
}) {
  const names = new Set(agents.map((a) => a.name));
  const showSelectedNotListed = Boolean(
    selectedAgent && agents.length > 0 && !names.has(selectedAgent),
  );

  return (
    <div className="relative min-w-0 max-w-[40%]">
      <Bot
        size={16}
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <label htmlFor="run-agent" className="sr-only">
        Agent
      </label>
      <select
        id="run-agent"
        value={selectedAgent}
        onChange={(e) => onAgentChange(e.target.value)}
        disabled={disabled}
        className={selectClass}
      >
        {agents.length === 0 ? (
          <option value={selectedAgent}>{selectedAgent || "Agent"}</option>
        ) : (
          <>
            {showSelectedNotListed && (
              <option value={selectedAgent}>{selectedAgent} (missing)</option>
            )}
            {agents.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </>
        )}
      </select>
      <span
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      >
        <ChevronDown size={12} strokeWidth={1.75} />
      </span>
    </div>
  );
}
