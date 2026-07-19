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
import AuthGate from './components/AuthGate';
import { AuthWorkspaceProvider } from './context/AuthWorkspaceContext';
import { queryClient, queryPersister } from './lib/queryClient';

function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 }}>
    <AuthWorkspaceProvider>
      <AuthGate>
        <Router>
          <Layout>
            <Routes>
          <Route path="/invite" element={<InviteAccept />} />
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/jobs" element={<ScrapeJobs />} />
          <Route path="/leads" element={<LeadsTable />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/follow-ups" element={<FollowUps />} />
            </Routes>
          </Layout>
        </Router>
      </AuthGate>
    </AuthWorkspaceProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
