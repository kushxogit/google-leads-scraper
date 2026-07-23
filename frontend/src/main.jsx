import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Render replaces hashed Vite chunks on each deploy. A browser that still has
// an older entry bundle can otherwise try to import a chunk that no longer
// exists and leave the UI unusable. Retry once with the fresh HTML document.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const reloadKey = "leadpilot-vite-preload-reload";
  if (window.sessionStorage.getItem(reloadKey)) return;
  window.sessionStorage.setItem(reloadKey, "1");
  window.location.reload();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
