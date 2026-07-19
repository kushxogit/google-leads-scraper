import { useState } from "react";
import {
  ArrowRight,
  KeyRound,
  LoaderCircle,
  Mail,
  Sparkles,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthWorkspace } from "../context/authWorkspace";

export default function AuthGate({ children }) {
  const { user, loading, error } = useAuthWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading)
    return (
      <div className="app-surface grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin text-violet-600" />
      </div>
    );
  if (user) return children;

  const withMessage = async (action, success) => {
    setSubmitting(true);
    setMessage("");
    const { error: authError } = await action();
    setSubmitting(false);
    setMessage(authError ? authError.message : success);
  };
  const passwordLogin = (event) => {
    event.preventDefault();
    return withMessage(
      () => supabase.auth.signInWithPassword({ email, password }),
      "Signed in successfully.",
    );
  };
  const magic = () =>
    withMessage(
      () =>
        supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.href },
        }),
      "Check your inbox for your secure sign-in link.",
    );
  const forgotPassword = () =>
    withMessage(
      () =>
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      "Check your inbox for a password-reset link.",
    );
  const google = async () => {
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
    if (authError) {
      setMessage(authError.message);
      setSubmitting(false);
    }
  };

  return (
    <main className="app-surface grid min-h-screen place-items-center p-5">
      <section className="relative w-full max-w-5xl overflow-hidden rounded-[36px] bg-[#171719] shadow-[0_30px_90px_rgba(52,37,95,.25)]">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-violet-600 blur-[100px] opacity-70" />
        <div className="grid min-h-[560px] md:grid-cols-[1.1fr_.9fr]">
          <div className="relative flex flex-col justify-between p-8 text-white sm:p-12">
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl liquid-button">
                <Sparkles size={20} />
              </span>
              <h1 className="mt-8 text-4xl font-extrabold leading-[.98] tracking-[-.065em] sm:text-5xl">
                A calmer way
                <br />
                to win great work.
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-300">
                Your leads, relationships, and next moves—beautifully in sync.
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              LeadPilot · a workspace for momentum
            </p>
          </div>
          <div className="m-3 rounded-[28px] bg-white p-7 sm:m-5 sm:p-9">
            <p className="eyebrow">Welcome back</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-.04em]">
              Sign in to LeadPilot
            </h2>
            <form onSubmit={passwordLogin} className="mt-7 space-y-4">
              <label className="block text-sm font-bold text-zinc-700">
                Email address
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="control mt-2 w-full"
                />
              </label>
              <label className="block text-sm font-bold text-zinc-700">
                Password
                <input
                  required
                  minLength="6"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  className="control mt-2 w-full"
                />
              </label>
              <button
                disabled={submitting}
                className="button-primary liquid-button w-full"
              >
                <KeyRound size={16} /> Sign in <ArrowRight size={16} />
              </button>
            </form>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={submitting || !email}
                onClick={forgotPassword}
                className="text-xs font-bold text-violet-600 hover:text-violet-800 disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>
            <div className="my-6 flex items-center gap-3 text-[10px] font-bold tracking-[.12em] text-zinc-300">
              <span className="h-px flex-1 bg-zinc-100" />
              OR
              <span className="h-px flex-1 bg-zinc-100" />
            </div>
            <button
              type="button"
              onClick={magic}
              disabled={submitting || !email}
              className="button-secondary w-full"
            >
              <Mail size={16} /> Send magic link
            </button>
            <button
              type="button"
              onClick={google}
              disabled={submitting}
              className="button-secondary mt-3 w-full"
            >
              Continue with Google
            </button>
            {(message || error) && (
              <p
                role="status"
                className="mt-5 rounded-2xl bg-violet-50 p-3 text-sm text-violet-700"
              >
                {message || error}
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
