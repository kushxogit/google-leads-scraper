import { createContext, useContext } from "react";

export const AuthWorkspaceContext = createContext(null);

export function useAuthWorkspace() {
  const value = useContext(AuthWorkspaceContext);
  if (!value) throw new Error("Auth workspace context is missing.");
  return value;
}
