import React from "react";
import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import Layout from "./components/Layout";
import AuthGate from "./components/AuthGate";
import { AuthWorkspaceProvider } from "./context/AuthWorkspaceContext";
import { queryClient, queryPersister } from "./lib/queryClient";
import { supabaseConfigError } from "./lib/supabase";
import FeedbackProvider from "./components/FeedbackProvider";

const DashboardOverview = lazy(() => import("./pages/DashboardOverview"));
const ScrapeJobs = lazy(() => import("./pages/ScrapeJobs"));
const LeadsTable = lazy(() => import("./pages/LeadsTable"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const Rewind = lazy(() => import("./pages/Rewind"));
const CalendarCallback = lazy(() => import("./pages/CalendarCallback"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
const Settings = lazy(() => import("./pages/Settings"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

function App() {
  if (supabaseConfigError) {
    return (
      <main className="app-surface grid min-h-screen place-items-center p-5">
        <section className="w-full max-w-xl rounded-[28px] bg-white p-8 shadow-[0_20px_50px_rgba(43,31,70,.18)]">
          <p className="eyebrow">Configuration needed</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-.04em]">
            LeadPilot cannot connect yet
          </h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            {supabaseConfigError}
          </p>
        </section>
      </main>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 24,
      }}
    >
      <AuthWorkspaceProvider>
        <AuthGate>
          <Router>
            <FeedbackProvider>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/invite" element={<InviteAccept />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/" element={<DashboardOverview />} />
                    <Route path="/jobs" element={<ScrapeJobs />} />
                    <Route path="/leads" element={<LeadsTable />} />
                    <Route path="/leads/:id" element={<LeadDetail />} />
                    <Route
                      path="/tracker"
                      element={<Navigate to="/leads" replace />}
                    />
                    <Route path="/rewind" element={<Rewind />} />
                    <Route
                      path="/calendar/callback"
                      element={<CalendarCallback />}
                    />
                    <Route
                      path="/follow-ups"
                      element={<Navigate to="/rewind" replace />}
                    />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Layout>
            </FeedbackProvider>
          </Router>
        </AuthGate>
      </AuthWorkspaceProvider>
    </PersistQueryClientProvider>
  );
}

export default App;

function PageLoader() {
  return (
    <div className="panel p-8 text-sm font-semibold text-zinc-500">
      Opening workspace…
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center">
      <section className="panel w-full p-8 text-center">
        <p className="eyebrow">404 · Lost signal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.05em]">
          This page is not part of your workspace.
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          Return to today’s work or open the pipeline.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className="button-primary">
            Go home
          </Link>
          <Link to="/leads" className="button-secondary">
            Open pipeline
          </Link>
        </div>
      </section>
    </div>
  );
}
