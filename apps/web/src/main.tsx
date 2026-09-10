import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom';
import './theme.css';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { TechnicalOntology } from './pages/TechnicalOntology';
import { SemanticExplorer } from './pages/SemanticExplorer';
import { GenieBuilder } from './pages/GenieBuilder';
import { Governance } from './pages/Governance';
import { DriftMonitoring } from './pages/DriftMonitoring';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: 'overview', element: <Overview /> },
      { path: 'ontology', element: <TechnicalOntology /> },
      { path: 'semantic', element: <SemanticExplorer /> },
      { path: 'genie', element: <GenieBuilder /> },
      { path: 'governance', element: <Governance /> },
      { path: 'drift', element: <DriftMonitoring /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
