import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardOverview from './pages/DashboardOverview';
import ScrapeJobs from './pages/ScrapeJobs';
import LeadsTable from './pages/LeadsTable';
import LeadDetail from './pages/LeadDetail';
import FollowUps from './pages/FollowUps';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/jobs" element={<ScrapeJobs />} />
          <Route path="/leads" element={<LeadsTable />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/follow-ups" element={<FollowUps />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
