import type { UserSettings } from "../../persist/userSettings";
import type {
  ComfyUIConfigPayload,
  OllamaModelOption,
  SearXNGConfigPayload,
} from "../../types";

export type SettingsTab = "general" | "image-generation" | "web-search";

export type ComfyUITestState =
  | { status: "idle" }
  | { status: "loading"; holdConnected?: boolean }
  | { status: "ok" }
  | { status: "err"; message: string };

export type OllamaTestState =
  | { status: "idle" }
  | {
      status: "loading";
      previousVersion?: string;
      holdSavedConnected?: boolean;
    }
  | { status: "ok"; version: string }
  | { status: "err"; message: string };

export type SearXNGTestState =
  | { status: "idle" }
  | { status: "loading"; holdConnected?: boolean }
  | { status: "ok" }
  | { status: "err"; message: string };

export type SettingsPageProps = {
  ollamaModels: OllamaModelOption[];
  currentSettings: UserSettings;
  ollamaHost: string;
  ollamaConnected: boolean | null;
  comfyuiHost: string;
  comfyuiConnected: boolean | null;
  comfyuiDefaultModel: string;
  comfyuiDefaultWidth: number;
  comfyuiDefaultHeight: number;
  comfyuiNegativePrompt: string;
  searxngHost: string;
  searxngConnected: boolean | null;
  onSave: (
    settings: UserSettings,
    ollamaHost: string,
    comfyui?: ComfyUIConfigPayload,
    searxng?: SearXNGConfigPayload,
  ) => Promise<void>;
  onBack: () => void;
};
