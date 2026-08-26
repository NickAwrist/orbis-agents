import { Save, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { SkillData, SkillWriteBody } from "../../persist/skills";
import { cx, primaryButton, secondaryButton } from "../../styles";

type Props = {
  isNew: boolean;
  skill: SkillData | null;
  editor: SkillWriteBody;
  setEditor: Dispatch<SetStateAction<SkillWriteBody>>;
  saving: boolean;
  deleting: boolean;
  saveDisabled: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (skill: SkillData) => void;
};

export function SkillEditor({
  isNew,
  skill,
  editor,
  setEditor,
  saving,
  deleting,
  saveDisabled,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  return (
    <div className="ui-animate-fade-in mx-auto max-w-2xl px-6 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[1.125rem] font-semibold text-foreground">
          {isNew ? "New skill" : `Edit: $${skill?.name ?? ""}`}
        </h2>
        {skill && (
          <button
            type="button"
            onClick={() => onDelete(skill)}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.75rem] text-red-400 transition-colors hover:bg-red-400/10 hover:text-red-300 disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 size={14} />
            Delete
          </button>
        )}
      </div>
      <p className="mb-6 max-w-xl text-[0.8125rem] leading-[1.55] text-muted-foreground">
        Agents see the name and description. They load the instructions only
        when the task matches, or when you type ${editor.name || "skill-name"}.
      </p>

      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.75rem] font-medium text-muted-foreground">
            Name
          </span>
          <div className="flex rounded-lg border border-border-subtle bg-background transition-colors focus-within:border-border">
            <span className="flex items-center border-r border-border-subtle px-3 font-mono text-[0.8125rem] text-muted-foreground">
              $
            </span>
            <input
              type="text"
              value={editor.name}
              onChange={(event) =>
                setEditor((current) => ({
                  ...current,
                  name: event.target.value.toLowerCase(),
                }))
              }
              placeholder="release-notes"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <span className="text-[0.6875rem] text-muted-foreground">
            Lowercase letters, numbers, and hyphens. Up to 64 characters.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.75rem] font-medium text-muted-foreground">
            Description
          </span>
          <textarea
            value={editor.description}
            onChange={(event) =>
              setEditor((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="When this skill should be used and what it helps with."
            maxLength={500}
            rows={3}
            className="rounded-lg border border-border-subtle bg-background px-3 py-2 text-[0.8125rem] leading-[1.5] text-foreground outline-none transition-colors focus:border-border placeholder:text-muted-foreground/50"
            style={{ resize: "vertical" }}
          />
          <span className="text-[0.6875rem] text-muted-foreground">
            This metadata lets the agent decide when to load the skill.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.75rem] font-medium text-muted-foreground">
            Instructions
          </span>
          <textarea
            value={editor.instructions}
            onChange={(event) =>
              setEditor((current) => ({
                ...current,
                instructions: event.target.value,
              }))
            }
            placeholder={
              "# Workflow\n\nDescribe the steps, constraints, and output format for this skill."
            }
            rows={15}
            className="rounded-lg border border-border-subtle bg-background px-3 py-2.5 font-mono text-[0.8125rem] leading-[1.6] text-foreground outline-none transition-colors focus:border-border placeholder:text-muted-foreground/50"
            style={{ resize: "vertical" }}
          />
          <span className="text-[0.6875rem] text-muted-foreground">
            Markdown body of the skill&apos;s SKILL.md file. The name and
            description above form its metadata.
          </span>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            aria-busy={saving}
            className={cx(primaryButton, saveDisabled && "opacity-60")}
          >
            <Save size={15} />
            Save
          </button>
          {!isNew && (
            <button
              type="button"
              onClick={onCancel}
              className={secondaryButton}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
