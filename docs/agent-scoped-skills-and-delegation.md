# Implementation handoff: agent-scoped skills and delegation routes

## Goal

Implement two related changes to Orbis agent configuration:

1. Skills remain user-owned reusable definitions, but each agent explicitly selects which skills it can use.
2. Agent-to-agent delegation becomes an explicit relation. Delegated agents must still be exposed to the model provider as callable tools, but the runtime must stop identifying them through the `_agent` name suffix or storing them in `agent_tools`.

Keep the change limited to these two behaviors. Follow the existing database, API, React, and test patterns.

## Required behavior

### Agent-scoped skills

Skill creation and editing must not change. A user still creates one skill with a name, description, and Markdown instructions under **Customization > Skills**.

The agent editor must gain a **Skills** fieldset alongside its existing tool and delegation controls. It lists the current user's skills and lets the user select any number of them for that agent.

Only skills assigned to the active agent are available during a run:

- Only assigned skill metadata appears in `<available_skills>`.
- `$skill-name` injects instructions only when that skill is assigned to the active agent.
- `load_skill` can load only an assigned skill. It must reject an unassigned skill even if the model guesses its name.
- A delegated agent uses its own skill assignments, not its parent's assignments.
- A new skill starts unassigned. The user assigns it from an agent editor.
- A new agent starts with no assigned skills.

An assignment points to the existing skill row. Do not copy skill contents into the agent record.

### Delegation routes

Keep delegated agents as provider-visible function tools. The provider interaction should remain:

1. The parent model receives one callable tool for each agent it may delegate to.
2. The parent emits a normal tool call containing `task` or `task_lines`.
3. Orbis starts a nested run using the target agent's prompt, tools, skills, and context.
4. Orbis returns the nested run's final text to the parent as the result of the original tool call.
5. The parent model continues and writes the user-facing response.

The existing tool loop in `BaseAgent` already implements steps 2 through 5. Preserve it.

Change how delegation is configured and resolved:

- Store allowed parent-to-child routes in their own table using agent IDs.
- Do not store target agent names in `agent_tools`.
- Do not use `toolName.endsWith("_agent")` or any other naming convention to detect a delegated agent.
- An agent called `reviewer`, `researcher`, or any other valid name must work as a delegated agent without a suffix.
- Renaming a target agent must not break existing routes.
- Deleting either side of a route must remove that route through foreign-key cascades.
- Keep one provider-visible tool per allowed target agent. Do not replace them with one generic `delegate` tool in this change.

The provider-visible delegation tool name must be function-safe and unique. Build it from a readable normalized target name plus a short stable portion of the target agent ID, for example `delegate_to_code_reviewer_a1b2c3d4`. The tool description must contain the target agent's display name and stored description. `AgentTool` must retain the target agent ID internally and resolve the child by that ID when executed. Never infer the target from the generated tool name.

## Non-goals

Do not add any of the following as part of this work:

- Parallel subagent execution
- Conversation handoffs where a child replaces the active user-facing agent
- New model or reasoning settings
- Sandboxing or approval policies
- Delegation depth limits or cycle detection beyond rejecting a direct self-route
- Skill scripts, references, assets, import, or export
- Changes to the underlying provider tool-call format
- Changes to skill authoring fields or the Skills editor

## Current implementation to replace

The relevant behavior currently lives in these areas:

- `src/agents/agentManager.ts` loads every user skill for every agent, adds `load_skill`, mixes built-in tools with agent tools, and recognizes delegation through `_agent`.
- `src/tools/AgentTool.ts` uses its provider tool name as the database agent name.
- `src/tools/load_skill.ts` authorizes by user ownership only, so every agent can load every user skill.
- `src/db/agents/queries.ts` hydrates only `agent_tools`.
- `src/db/agents/seed.ts` stores both built-in tools and delegated agent names in one `tools` array.
- `ui/components/AgentsPage/AgentEditor.tsx` presents tools and other agents, but no skills.
- `ui/components/AgentsPage/useAgentsPage.ts` sends other agent names through the same `tools` array as built-in tools.

Do not preserve the `_agent` heuristic as a fallback after migration. Remove it.

## Data model

Add two join tables.

```sql
CREATE TABLE agent_skills (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, skill_id)
);

CREATE TABLE agent_delegations (
  source_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source_agent_id, target_agent_id),
  CHECK (source_agent_id != target_agent_id)
);
```

Use `position` consistently with `agent_tools`, even though the current UI treats selections as unordered. Query all three capability lists in position order.

Extend the agent API shape with stable IDs:

```ts
type AgentData = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  is_default: number;
  tools: string[];
  skill_ids: string[];
  delegate_agent_ids: string[];
  created_at: number;
  updated_at: number;
};
```

Agent create and update bodies must accept the same three arrays. Keep `tools` as built-in tool names. Use IDs for skills and delegation routes.

Validate on the server that:

- Every `skill_id` belongs to the requesting user.
- Every delegated target belongs to the requesting user.
- The source agent does not delegate directly to itself.
- Duplicate IDs are rejected or normalized before persistence.
- A missing or cross-user ID produces a `400 VALIDATION_ERROR`, not a partial save.

Create or update the agent, tools, skill assignments, and delegation routes in one transaction.

## Migration requirements

The migration must preserve existing behavior and must be idempotent.

Let the migration functions own creation of the two join tables so they can
reliably distinguish a new table from one created during an earlier startup.
Run these migrations after the existing agent ownership migration. Do not add
an unconditional cross-join backfill outside that one-time creation path.

### Existing skills

When `agent_skills` is created for an existing database, assign every existing skill to every existing agent with the same `owner_uuid`. This preserves the current behavior where all agents receive all skills.

Perform this cross-join once, only when introducing the table. Do not run it on every startup. Skills created after the migration must remain unassigned until the user selects them.

### Existing delegated agents

When `agent_delegations` is created, inspect existing `agent_tools` rows:

- If `tool_name` is a known built-in tool, leave it in `agent_tools`.
- Otherwise, if `tool_name` matches an agent owned by the same user, insert a route from the source agent to that target agent and remove the row from `agent_tools`.
- Remove any remaining unknown stale name from `agent_tools`. The current runtime already filters these values, so they do not represent working behavior. Do not guess a target.

Matching all same-owner agent names intentionally recovers custom delegation selections that the UI stored but the `_agent` runtime heuristic silently ignored.

The migration must pass `PRAGMA foreign_key_check` and must preserve the current foreign-key setting after it runs. Add focused migration tests patterned after `tests/db/userOwnershipMigration.test.ts`.

### Default-agent seeding

Update `src/db/agents/seed.ts` so default definitions separate `tools` from `delegates`.

Preserve the current default behavior:

- `general_agent` has `web_search` as a built-in tool.
- `general_agent` may delegate to `computer_agent`.
- `computer_agent` has `bash`.
- `coding_agent` keeps its current built-in tools.

Insert all default agent rows first, retain a name-to-ID map, then insert built-in tools and delegation routes. Do not store `computer_agent` in `agent_tools`.

## Backend implementation

### Database queries

Add focused query functions for:

- Listing skills assigned to one agent, scoped by `owner_uuid`
- Hydrating an agent's `skill_ids`
- Hydrating an agent's `delegate_agent_ids`
- Listing the full target agent rows for one source agent

Update `getAgentById`, `getAgentByName`, and `listAgents` to return all three capability lists. Avoid duplicating the same hydration SQL in each function if a small private helper fits the existing module.

Export the new query functions and types through `src/db/index.ts`.

### Skill runtime

In `agentManager.createAgent`:

1. Load only the skills assigned to the selected agent.
2. Pass only those rows to `renderSkillsPrompt`.
3. Add `LoadSkillTool` only when the agent has at least one assigned skill.

Change `LoadSkillTool` so its authorization is agent-scoped. A straightforward implementation is to construct it with the already loaded `SkillRow[]` and resolve names from that immutable list. This avoids a second query and prevents access to an unassigned skill. Do not pass all user skills into the tool.

Keep `renderSkillsPrompt` provider-neutral. Its existing progressive disclosure and `$skill-name` behavior should continue to work once it receives the scoped list.

### Delegation runtime

Remove agent handling from `getToolInstance` and `isToolEnabled`. Those functions should handle built-in tools only.

After adding the configured built-in tools, load the active agent's permitted delegation targets. Create one `AgentTool` for each route and add it to the agent's tool map.

Refactor `AgentTool` to receive at least:

```ts
type AgentToolTarget = {
  id: string;
  name: string;
  description: string;
};
```

Its provider tool name comes from the function-safe route-name helper. Its description identifies the target. Its `execute` method uses `target.id`, not `this.name`, to create the child agent.

Add an ID-based agent creation path such as `createAgentById` and `createAgentByIdForContext`. Keep the existing name-based creation path for selecting the root agent and restoring sessions. Both paths should share one private constructor path rather than duplicating prompt, skill, and tool setup.

The child must continue to inherit the current run context and parent model as it does today. This task does not change model inheritance.

## Frontend implementation

Keep the existing Customization tabs. Do not move skill creation into the agent editor.

### Loading data

Update `useAgentsPage` to load agents, built-in tools, and skills together. Reuse `fetchSkills` from `ui/persist/skills.ts`.

Extend `AgentEditorState`, `AgentData`, and `AgentWriteBody` with:

```ts
skill_ids: string[];
delegate_agent_ids: string[];
```

Update empty state, server-to-editor conversion, dirty comparison, create, and update handling. Compare all selection arrays without depending on order.

### Agent editor

The editor should have these separate controls:

1. **Tools** selects built-in tool names.
2. **Skills** selects user skill IDs while displaying skill names.
3. **Delegation routes** selects other agent IDs while displaying agent names.

Use the existing chip/button interaction and visual style. The delegation list must exclude the agent being edited. A new unsaved agent may select any existing agent.

Add short helper text under Skills stating that the agent sees and can load only selected skills. Add short helper text under Delegation routes stating that selected agents appear to the model as callable delegation tools.

Do not put agent names into `editor.tools` after this change.

## API compatibility

This is an internal application API, so update the frontend and backend together. For a short transition, the backend may treat missing `skill_ids` and `delegate_agent_ids` as empty arrays. Do not infer delegation from values in `tools` after the database migration has completed.

Do not change skill CRUD request or response fields.

## Tests

Add tests that protect the behavior rather than component internals.

### Database and migration

- An existing skill is assigned to all same-owner existing agents during the one-time migration.
- A skill created after migration stays unassigned when migrations run again.
- A built-in tool remains in `agent_tools`.
- A stored same-owner agent name moves from `agent_tools` to `agent_delegations`, including a name without `_agent`.
- Cross-user agents are never connected during migration.
- Renaming a delegated target leaves the ID-based route intact.
- Deleting a skill or agent cascades its join rows.
- `PRAGMA foreign_key_check` returns no rows.

### API

- Agent create and update persist `tools`, `skill_ids`, and `delegate_agent_ids`.
- Agent list and detail responses return all three arrays.
- Cross-user or nonexistent skill and delegate IDs return `400` and do not partially update the agent.
- A direct self-delegation returns `400`.
- Deleting a skill removes its agent assignments.

### Skill runtime

- Assigned skill metadata appears without eager instructions.
- Unassigned skill metadata does not appear.
- `$assigned-skill` activates its instructions.
- `$unassigned-skill` does not activate its instructions.
- `load_skill` returns an error for an unassigned skill.
- A child agent receives its own skill list rather than the parent's.

### Delegation runtime

- An allowed target named `reviewer` becomes a provider-visible delegation tool despite lacking `_agent`.
- A configured built-in tool still resolves normally.
- Calling the delegation tool starts the target by ID and returns its final result through the existing tool-result path.
- A target agent that is not in the source agent's routes is not included in the provider tool list.
- No runtime branch uses `endsWith("_agent")`.

Add a small unit test for the route-name helper. Cover invalid characters and uniqueness between two agents with the same normalized display name.

## Verification

Run the focused tests while implementing, then run:

```bash
bunx tsc --noEmit
bun run lint
bun test
bun run build
```

If an unrelated pre-existing failure prevents one of these commands from passing, record the exact failure in the handoff rather than weakening the check.

## Acceptance criteria

The work is complete when all of the following are true:

- Users create and edit skills exactly as before.
- Users can assign and unassign skills from each agent editor.
- An agent cannot see, explicitly activate, or load an unassigned skill.
- Existing skills remain available to existing agents immediately after migration.
- The agent API and database store skill assignments by ID.
- Delegation routes are stored separately from built-in tools using source and target agent IDs.
- Delegated agents still appear to the model provider as normal callable tools.
- A delegated agent name does not need to end in `_agent`.
- `agent_tools` contains built-in tool names only.
- Renaming or deleting an agent does not leave a broken name-based delegation reference.
- Root and delegated agents each use their own configured skills and tools.
- Existing tool-call continuation behavior in `BaseAgent` remains intact.
- Focused migration, API, skill runtime, and delegation tests pass.
- Type checking, linting, the full test suite, and the production build pass.

## Likely files to touch

Backend:

- `src/db/connection.ts`
- `src/db/migrations.ts`
- `src/db/index.ts`
- `src/db/agents/types.ts`
- `src/db/agents/queries.ts`
- `src/db/agents/seed.ts`
- `src/db/skills/queries.ts`
- `src/routes/agents.ts`
- `src/agents/agentManager.ts`
- `src/tools/AgentTool.ts`
- `src/tools/load_skill.ts`

Frontend:

- `ui/persist/agents.ts`
- `ui/components/AgentsPage/types.ts`
- `ui/components/AgentsPage/agentsPageUtils.ts`
- `ui/components/AgentsPage/useAgentsPage.ts`
- `ui/components/AgentsPage/AgentEditor.tsx`

Tests and documentation:

- `tests/db/userOwnershipMigration.test.ts` or a new focused migration test file
- `tests/e2e/sanity.test.ts`
- `tests/e2e/skills.test.ts`
- `tests/skills/runtime.test.ts`
- New focused agent-manager or delegation tests
- `README.md`

This list is a guide. Keep the final diff smaller if the implementation can meet the contract without touching every file.
