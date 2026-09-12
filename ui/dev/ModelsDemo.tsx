import { useState } from "react";
import { ModelSelectBar } from "../components/ModelSelectBar";
import { OpenRouterSettingsTab } from "../components/SettingsPage/OpenRouterSettingsTab";
import { useOllamaConnection } from "../hooks/run/useOllamaConnection";

// All API requests are intercepted by the browser fixture, with no live backend.
export default function ModelsDemo() {
  const connection = useOllamaConnection();
  const [selected, setSelected] = useState("local-model");
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <OpenRouterSettingsTab onModelsChanged={connection.refreshOllamaModels} />
      <div className="fixed bottom-4 left-4 rounded-xl border border-border-subtle bg-background p-3">
        <ModelSelectBar
          ollamaModels={connection.ollamaModels}
          ollamaConnected={connection.ollamaConnected}
          modelsLoadError={connection.modelsLoadError}
          selectedModel={selected}
          onModelChange={setSelected}
          disabled={false}
        />
        <output aria-label="Selected model">{selected}</output>
      </div>
    </main>
  );
}
