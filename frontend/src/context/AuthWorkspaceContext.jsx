import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

const Context = createContext(null);
const storageKey = (id) => `leadpilot.active-workspace.${id}`;

export function AuthWorkspaceProvider({ children }) {
  const [session, setSession] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadWorkspaces = useCallback(async (userId) => {
    const { data, error: queryError } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(id, name, type, created_by)")
      .eq("user_id", userId)
      .order("joined_at");
    if (queryError) throw queryError;
    const next = (data ?? [])
      .map((row) => row.workspaces)
      .filter(Boolean)
      .sort(
        (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
      );
    setWorkspaces(next);
    setActiveWorkspaceId((current) => {
      const saved = window.localStorage.getItem(storageKey(userId));
      const preferred = current || saved;
      return next.some((workspace) => workspace.id === preferred)
        ? preferred
        : (next[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const start = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (!active) return;
      setSession(initialSession);
      try {
        if (initialSession) await loadWorkspaces(initialSession.user.id);
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    start();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError(null);
      if (!nextSession) {
        setWorkspaces([]);
        setActiveWorkspaceId(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      loadWorkspaces(nextSession.user.id)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadWorkspaces]);

  useEffect(() => {
    if (session?.user?.id && activeWorkspaceId)
      window.localStorage.setItem(
        storageKey(session.user.id),
        activeWorkspaceId,
      );
  }, [activeWorkspaceId, session?.user?.id]);

  const selectWorkspace = useCallback(
    (id) => {
      if (workspaces.some((workspace) => workspace.id === id))
        setActiveWorkspaceId(id);
    },
    [workspaces],
  );

  const createTeamWorkspace = useCallback(
    async (name) => {
      const { data, error: insertError } = await supabase.rpc(
        "create_team_workspace",
        { p_name: name.trim() },
      );
      if (insertError) throw insertError;
      await loadWorkspaces(session.user.id);
      setActiveWorkspaceId(data.id);
    },
    [loadWorkspaces, session?.user?.id],
  );

  const refreshWorkspaces = useCallback(async () => {
    if (session?.user?.id) await loadWorkspaces(session.user.id);
  }, [loadWorkspaces, session?.user?.id]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      workspaces,
      activeWorkspaceId,
      activeWorkspace:
        workspaces.find((item) => item.id === activeWorkspaceId) ?? null,
      loading,
      error,
      selectWorkspace,
      createTeamWorkspace,
      refreshWorkspaces,
      signOut: () => supabase.auth.signOut(),
    }),
    [
      activeWorkspaceId,
      createTeamWorkspace,
      error,
      loading,
      refreshWorkspaces,
      selectWorkspace,
      session,
      workspaces,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuthWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Auth workspace context is missing.");
  return value;
}
