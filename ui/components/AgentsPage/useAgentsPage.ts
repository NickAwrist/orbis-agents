import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AgentData,
  createAgentApi,
  deleteAgentApi,
  fetchAgents,
  fetchBuiltinTools,
  putDefaultRunAgentApi,
  updateAgentApi,
} from "../../persist/agents";
import { type SkillData, fetchSkills } from "../../persist/skills";
import {
  canDeleteAgent,
  editorFromAgent,
  editorsEqual,
  emptyEditor,
  reconcileEditorAfterRefresh,
  removeUnavailableCapabilityIds,
} from "./agentsPageUtils";
import type { AgentEditorState } from "./types";

export function useAgentsPage({
  defaultRunAgent,
  onDefaultRunAgentChange,
}: {
  defaultRunAgent: string;
  onDefaultRunAgentChange: (name: string) => void;
}) {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [builtinTools, setBuiltinTools] = useState<string[]>([]);
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editor, setEditor] = useState<AgentEditorState>(emptyEditor());
  const [baselineEditor, setBaselineEditor] = useState<AgentEditorState>(() =>
    emptyEditor(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultDraft, setDefaultDraft] = useState(defaultRunAgent);
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [openMenu, setOpenMenu] = useState<{
    id: string;
    anchorRect: DOMRect;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const refreshGenerationRef = useRef(0);
  const selectedIdRef = useRef(selectedId);
  const isNewRef = useRef(isNew);
  const editorRef = useRef(editor);
  const baselineEditorRef = useRef(baselineEditor);
  selectedIdRef.current = selectedId;
  isNewRef.current = isNew;
  editorRef.current = editor;
  baselineEditorRef.current = baselineEditor;

  const fetchPageData = useCallback(async () => {
    const [agentList, tools, skillList] = await Promise.all([
      fetchAgents(),
      fetchBuiltinTools(),
      fetchSkills(),
    ]);
    return { agentList, tools, skillList };
  }, []);

  const applyPageData = useCallback(
    (data: Awaited<ReturnType<typeof fetchPageData>>) => {
      const { agentList, tools, skillList } = data;
      setAgents(agentList);
      setBuiltinTools(tools);
      setSkills(skillList);
    },
    [fetchPageData],
  );

  const load = useCallback(async () => {
    const data = await fetchPageData();
    applyPageData(data);
    return data;
  }, [applyPageData, fetchPageData]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDefaultDraft(defaultRunAgent);
  }, [defaultRunAgent]);

  const otherAgents = agents.filter((agent) => agent.id !== selectedId);

  const refreshSelectedEditor = async () => {
    const refreshGeneration = ++refreshGenerationRef.current;
    const data = await fetchPageData();
    if (refreshGeneration !== refreshGenerationRef.current) return;
    applyPageData(data);

    const { agentList, skillList } = data;
    const availableSkillIds = new Set(skillList.map((skill) => skill.id));
    const availableAgentIds = new Set(agentList.map((agent) => agent.id));
    if (isNewRef.current) {
      const nextEditor = removeUnavailableCapabilityIds(
        editorRef.current,
        availableSkillIds,
        availableAgentIds,
      );
      editorRef.current = nextEditor;
      setEditor(nextEditor);
      return;
    }
    const currentSelectedId = selectedIdRef.current;
    if (!currentSelectedId) return;
    const refreshedAgent = agentList.find(
      (agent) => agent.id === currentSelectedId,
    );
    if (!refreshedAgent) {
      selectedIdRef.current = null;
      editorRef.current = emptyEditor();
      baselineEditorRef.current = emptyEditor();
      setSelectedId(null);
      setEditor(editorRef.current);
      setBaselineEditor(baselineEditorRef.current);
      return;
    }
    const reconciled = reconcileEditorAfterRefresh(
      editorRef.current,
      baselineEditorRef.current,
      refreshedAgent,
      availableSkillIds,
      availableAgentIds,
    );
    editorRef.current = reconciled.editor;
    baselineEditorRef.current = reconciled.baseline;
    setEditor(reconciled.editor);
    setBaselineEditor(reconciled.baseline);
  };

  const selectAgent = (a: AgentData) => {
    setSelectedId(a.id);
    setIsNew(false);
    const next = editorFromAgent(a);
    setEditor(next);
    setBaselineEditor(next);
    setError(null);
  };

  const startNew = () => {
    setSelectedId(null);
    setIsNew(true);
    const blank = emptyEditor();
    setEditor(blank);
    setBaselineEditor(blank);
    setError(null);
  };

  const toggleTool = (tool: string) => {
    setEditor((prev) => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter((t) => t !== tool)
        : [...prev.tools, tool],
    }));
  };

  const toggleSkill = (skillId: string) => {
    setEditor((previous) => ({
      ...previous,
      skill_ids: previous.skill_ids.includes(skillId)
        ? previous.skill_ids.filter((id) => id !== skillId)
        : [...previous.skill_ids, skillId],
    }));
  };

  const toggleDelegation = (agentId: string) => {
    setEditor((previous) => ({
      ...previous,
      delegate_agent_ids: previous.delegate_agent_ids.includes(agentId)
        ? previous.delegate_agent_ids.filter((id) => id !== agentId)
        : [...previous.delegate_agent_ids, agentId],
    }));
  };

  const handleSave = async () => {
    refreshGenerationRef.current += 1;
    setError(null);
    if (editorsEqual(editor, baselineEditor)) return;
    if (!editor.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await createAgentApi(editor);
        await load();
        const saved = editorFromAgent(created);
        setSelectedId(created.id);
        setIsNew(false);
        setEditor(saved);
        setBaselineEditor(saved);
      } else if (selectedId) {
        await updateAgentApi(selectedId, editor);
        await load();
        setBaselineEditor({
          ...editor,
          tools: [...editor.tools],
          skill_ids: [...editor.skill_ids],
          delegate_agent_ids: [...editor.delegate_agent_ids],
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async () => {
    if (!pendingDelete) return;
    refreshGenerationRef.current += 1;
    const { id } = pendingDelete;
    setOpenMenu(null);
    setDeleting(true);
    setError(null);
    try {
      await deleteAgentApi(id);
      setPendingDelete(null);
      if (selectedId === id) {
        setSelectedId(null);
        setIsNew(false);
        setEditor(emptyEditor());
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const requestDeleteAgent = (a: AgentData) => {
    if (!canDeleteAgent(a)) return;
    setError(null);
    setPendingDelete({ id: a.id, name: a.name });
  };

  const persistDefaultAgent = async (name: string, previous: string) => {
    try {
      const next = await putDefaultRunAgentApi(name);
      setDefaultDraft(next);
      onDefaultRunAgentChange(next);
    } catch (err: unknown) {
      setDefaultDraft(previous);
      setError(err instanceof Error ? err.message : "Failed to save default");
    } finally {
      setDefaultSaving(false);
    }
  };

  const handleDefaultAgentChange = (name: string) => {
    const previous = defaultDraft;
    setDefaultDraft(name);
    setDefaultSaving(true);
    setError(null);
    void persistDefaultAgent(name, previous);
  };

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null;
  const showEditor = isNew || selectedId;
  const editorDirty = !editorsEqual(editor, baselineEditor);

  return {
    agents,
    builtinTools,
    skills,
    selectedId,
    setSelectedId,
    isNew,
    setIsNew,
    editor,
    setEditor,
    saving,
    editorDirty,
    error,
    defaultDraft,
    defaultSaving,
    pendingDelete,
    setPendingDelete,
    openMenu,
    setOpenMenu,
    deleting,
    load,
    refreshSelectedEditor,
    otherAgents,
    selectAgent,
    startNew,
    toggleTool,
    toggleSkill,
    toggleDelegation,
    handleSave,
    performDelete,
    requestDeleteAgent,
    handleDefaultAgentChange,
    selectedAgent,
    showEditor,
  };
}
