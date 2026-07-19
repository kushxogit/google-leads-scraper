import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Layout from './components/Layout';
import DashboardOverview from './pages/DashboardOverview';
import ScrapeJobs from './pages/ScrapeJobs';
import LeadsTable from './pages/LeadsTable';
import LeadDetail from './pages/LeadDetail';
import FollowUps from './pages/FollowUps';
import Tracker from './pages/Tracker';
import InviteAccept from './pages/InviteAccept';
import Settings from './pages/Settings';
import ResetPassword from './pages/ResetPassword';
import AuthGate from './components/AuthGate';
import { AuthWorkspaceProvider } from './context/AuthWorkspaceContext';
import { queryClient, queryPersister } from './lib/queryClient';
import { supabaseConfigError } from './lib/supabase';

function App() {
  if (supabaseConfigError) {
    return (
      <main className="app-surface grid min-h-screen place-items-center p-5">
        <section className="w-full max-w-xl rounded-[28px] bg-white p-8 shadow-[0_20px_50px_rgba(43,31,70,.18)]">
          <p className="eyebrow">Configuration needed</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-.04em]">LeadPilot cannot connect yet</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600">{supabaseConfigError}</p>
        </section>
      </main>
    );
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 }}>
    <AuthWorkspaceProvider>
      <AuthGate>
        <Router>
          <Layout>
            <Routes>
          <Route path="/invite" element={<InviteAccept />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/jobs" element={<ScrapeJobs />} />
          <Route path="/leads" element={<LeadsTable />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </AuthGate>
    </AuthWorkspaceProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
