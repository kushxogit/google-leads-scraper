import { createContext, useContext } from "react";

export const FeedbackContext = createContext(null);
export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("Feedback provider is missing.");
  return value;
}
