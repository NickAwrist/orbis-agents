import type { Tool } from "ollama";
import { getSkillByName } from "../db/index";
import { BaseTool } from "./BaseTool";

export class LoadSkillTool extends BaseTool {
  constructor(private readonly ownerUuid: string) {
    super(
      "load_skill",
      "Load the full instructions for an available user skill before applying it.",
    );
  }

  override toTool(): Tool {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Exact skill name from <available_skills>.",
            },
          },
          required: ["name"],
        },
      },
    };
  }

  override async execute(args: Record<string, unknown>): Promise<string> {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!name) return "Error: skill name is required";
    const skill = getSkillByName(this.ownerUuid, name);
    if (!skill) return `Error: skill '${name}' not found`;
    return JSON.stringify({
      name: skill.name,
      instructions: skill.instructions,
    });
  }
}
