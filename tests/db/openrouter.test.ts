import "../setup";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createOpenRouterModel,
  deleteOpenRouterModel,
  getOpenRouterApiKey,
  listOpenRouterModels,
  setOpenRouterApiKey,
} from "../../src/db";
import { getDb } from "../../src/db/connection";
import { seedDefaultOpenRouterModels } from "../../src/db/openrouter";

describe("OpenRouter Database Integration", () => {
  beforeEach(() => {
    const db = getDb();
    // Clear openrouter_models and app_settings to ensure a clean state
    db.run("DELETE FROM openrouter_models");
    db.run("DELETE FROM app_settings");
  });

  afterEach(() => {
    const db = getDb();
    db.run("DELETE FROM openrouter_models");
    db.run("DELETE FROM app_settings");
    seedDefaultOpenRouterModels(db);
  });

  test("should seed default models transactionally", () => {
    const db = getDb();
    // Seed default models again since we cleared the table
    seedDefaultOpenRouterModels(db);

    const models = listOpenRouterModels();
    expect(models).toHaveLength(7);

    const routes = models.map((m) => m.route);
    expect(routes).toContain("openai/gpt-5.6-terra");
    expect(routes).toContain("openai/gpt-5.6-luna");
    expect(routes).toContain("anthropic/claude-opus-4.8");
    expect(routes).toContain("anthropic/claude-sonnet-5");
    expect(routes).toContain("anthropic/claude-fable-5");
    expect(routes).toContain("google/gemini-3.5-flash");
    expect(routes).toContain("google/gemini-3.1-pro-preview");

    // Re-seeding does not recreate a model the user deliberately removed.
    deleteOpenRouterModel(models[0]!.id);
    seedDefaultOpenRouterModels(db);
    const modelsAfterReSeed = listOpenRouterModels();
    expect(modelsAfterReSeed).toHaveLength(6);
  });

  test("should support CRUD operations on OpenRouter models", () => {
    // 1. Initially empty (cleared in beforeEach)
    let models = listOpenRouterModels();
    expect(models).toHaveLength(0);

    // 2. Create a model using object style
    const createdObj = createOpenRouterModel({
      name: "DeepSeek V3",
      route: "deepseek/deepseek-chat",
      ai_lab: "DeepSeek",
    });
    expect(createdObj.id).toBeInteger();
    expect(createdObj.name).toBe("DeepSeek V3");
    expect(createdObj.route).toBe("deepseek/deepseek-chat");
    expect(createdObj.ai_lab).toBe("DeepSeek");

    // 3. Create a second model
    const createdPos = createOpenRouterModel({
      name: "Llama 3 70B Instruct",
      route: "meta-llama/llama-3-70b-instruct",
      ai_lab: "Meta",
    });
    expect(createdPos.id).toBeInteger();
    expect(createdPos.name).toBe("Llama 3 70B Instruct");
    expect(createdPos.route).toBe("meta-llama/llama-3-70b-instruct");
    expect(createdPos.ai_lab).toBe("Meta");

    // 4. List models (should be ordered by name ASC: DeepSeek V3, Llama 3 70B Instruct)
    models = listOpenRouterModels();
    expect(models).toHaveLength(2);
    expect(models[0]?.name).toBe("DeepSeek V3");
    expect(models[1]?.name).toBe("Llama 3 70B Instruct");

    // 5. Delete a model
    const deleteResult = deleteOpenRouterModel(createdObj.id);
    expect(deleteResult).toBeTrue();

    // 6. List models after deletion
    models = listOpenRouterModels();
    expect(models).toHaveLength(1);
    expect(models[0]?.name).toBe("Llama 3 70B Instruct");

    // 7. Delete non-existing model
    const deleteNonExisting = deleteOpenRouterModel(99999);
    expect(deleteNonExisting).toBeFalse();
  });

  test("should set and get OpenRouter API key with env fallback", () => {
    expect(getOpenRouterApiKey()).toBe("");

    // 2. Set API key in settings
    const testKey = "sk-or-test-key-12345";
    setOpenRouterApiKey(testKey);

    // 3. Retrieve API key (should now get the value from database settings)
    expect(getOpenRouterApiKey()).toBe(testKey);

    // 4. Setting empty/whitespace key
    setOpenRouterApiKey("   ");
    expect(getOpenRouterApiKey()).toBe("");
  });
});
