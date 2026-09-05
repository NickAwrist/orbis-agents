import { describe, expect, test } from "bun:test";
import {
  exactRunCommand,
  matchingRunCommands,
} from "../../ui/components/runCommands";

describe("run commands", () => {
  test("recognizes exact workspace commands for local UI handling", () => {
    expect(exactRunCommand("/directory")).toBe("directory");
    expect(exactRunCommand(" /sandbox ")).toBe("sandbox");
    expect(exactRunCommand("/workspace")).toBe("workspace");
  });

  test("does not consume ordinary model messages", () => {
    expect(exactRunCommand("/directory please")).toBeNull();
    expect(exactRunCommand("Tell me about /sandbox")).toBeNull();
    expect(exactRunCommand("/unknown")).toBeNull();
  });

  test("filters the command menu from a leading slash token", () => {
    expect(
      matchingRunCommands("/dir", "sandbox").map((command) => command.name),
    ).toEqual(["directory"]);
    expect(matchingRunCommands("hello /dir", "sandbox")).toEqual([]);
  });

  test("only offers returning to the private workspace from a directory", () => {
    expect(
      matchingRunCommands("/", "sandbox").map((command) => command.name),
    ).toEqual(["directory", "workspace"]);
    expect(
      matchingRunCommands("/", "local").map((command) => command.name),
    ).toEqual(["directory", "sandbox", "workspace"]);
    expect(matchingRunCommands("/sandbox", "sandbox")).toEqual([]);
  });
});
