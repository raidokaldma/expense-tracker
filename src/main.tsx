import { type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { createHttpApi } from './api/httpApi';
import { withRequestLog } from './api/requestLog';
import { AppShell } from './components/AppShell';
import { useNarrowScreen } from './components/useNarrowScreen';
import { MobileOverviewPage } from './pages/mobile/MobileOverviewPage';
import { MobileTransactionsPage } from './pages/mobile/MobileTransactionsPage';
import { OverviewPage } from './pages/overview/OverviewPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { TransactionsPage } from './pages/transactions/TransactionsPage';
import { importTransactions, load } from './store/store';
import './styles/global.css';

/** Phones get read-only views of the same routes. */
function ByWidth({ wide, narrow }: { wide: ReactNode; narrow: ReactNode }) {
  return useNarrowScreen() ? narrow : wide;
}

// hash URLs (#/overview) work on any static host without server rewrites
const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/transactions" replace /> },
      { path: 'transactions', element: <ByWidth wide={<TransactionsPage />} narrow={<MobileTransactionsPage />} /> },
      { path: 'overview', element: <ByWidth wide={<OverviewPage />} narrow={<MobileOverviewPage />} /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/transactions" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

const api = withRequestLog(createHttpApi());
// imports can also be run from the browser console:
//   await expenseTracker.import([{ externalId, account, occurredAt, counterparty, amount, description }])
Object.assign(window, { expenseTracker: { api, import: importTransactions } });
void load(api);
