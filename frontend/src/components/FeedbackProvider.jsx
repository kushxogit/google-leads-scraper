import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { FeedbackContext } from "../context/feedback";

export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);
  const dismiss = useCallback(
    (id) => setToasts((items) => items.filter((item) => item.id !== id)),
    [],
  );
  const notify = useCallback(
    (message, type = "success") => {
      const id = crypto.randomUUID();
      setToasts((items) => [...items, { id, message, type }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );
  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setDialog({
          title: options.title || "Are you sure?",
          description: options.description || "",
          confirmLabel: options.confirmLabel || "Continue",
          danger: Boolean(options.danger),
        });
      }),
    [],
  );
  const answer = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog(null);
  };
  const value = useMemo(() => ({ notify, confirm }), [confirm, notify]);
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed right-4 top-4 z-[120] w-[min(380px,calc(100vw-32px))] space-y-2"
      >
        {toasts.map((toast) => {
          const Icon =
            toast.type === "error"
              ? AlertTriangle
              : toast.type === "info"
                ? Info
                : CheckCircle2;
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur ${toast.type === "error" ? "border-rose-200 text-rose-700" : "border-emerald-100 text-emerald-700"}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-semibold leading-5">
                {toast.message}
              </p>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss message"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
      {dialog && (
        <div
          className="fixed inset-0 z-[115] grid place-items-center bg-zinc-950/35 p-4 backdrop-blur-sm"
          onMouseDown={() => answer(false)}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="panel w-full max-w-md bg-white p-6"
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-2xl ${dialog.danger ? "bg-rose-100 text-rose-600" : "bg-violet-100 text-violet-600"}`}
            >
              <AlertTriangle size={20} />
            </span>
            <h2 id="confirm-title" className="mt-5 text-xl font-extrabold">
              {dialog.title}
            </h2>
            {dialog.description && (
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {dialog.description}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                autoFocus
                onClick={() => answer(false)}
                className="button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => answer(true)}
                className={
                  dialog.danger
                    ? "inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white"
                    : "button-primary"
                }
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
