/** Normalized entry from GET /api/models. */
export interface ModelOption {
  id: string;
  name: string;
  provider: "ollama" | "openrouter";
  lab: string;
  route?: string;
  configured?: boolean;
  size?: number;
  modified_at?: string;
  digest?: string;
}
