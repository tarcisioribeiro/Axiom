import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { AlertDialogProvider } from './components/providers/AlertDialogProvider';
import { Toaster } from './components/ui/toaster';
import { queryClient } from './lib/query-client';
// Eager load (páginas públicas carregadas imediatamente)
import Login from './pages/Login';
import Register from './pages/Register';
import ShareCredential from './pages/ShareCredential';
import Unauthorized from './pages/Unauthorized';
import { useAuthStore } from './stores/auth-store';

// Lazy load (páginas protegidas carregadas sob demanda)
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Expenses = lazy(() => import('./pages/Expenses'));
const FixedExpenses = lazy(() => import('./pages/FixedExpenses'));
const CategorizationRules = lazy(() => import('./pages/CategorizationRules'));
const Revenues = lazy(() => import('./pages/Revenues'));
const CreditCards = lazy(() => import('./pages/CreditCards'));
const CreditCardExpenses = lazy(() => import('./pages/CreditCardExpenses'));
const Transfers = lazy(() => import('./pages/Transfers'));
const Loans = lazy(() => import('./pages/Loans'));
const Payables = lazy(() => import('./pages/Payables'));
const Members = lazy(() => import('./pages/Members'));
const MemberFinancialReport = lazy(() => import('./pages/MemberFinancialReport'));

// Security Module
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'));
const Passwords = lazy(() => import('./pages/Passwords'));
const StoredCards = lazy(() => import('./pages/StoredCards'));
const StoredAccounts = lazy(() => import('./pages/StoredAccounts'));
const Archives = lazy(() => import('./pages/Archives'));

// Library Module
const LibraryDashboard = lazy(() => import('./pages/LibraryDashboard'));
const Books = lazy(() => import('./pages/Books'));
const Authors = lazy(() => import('./pages/Authors'));
const Publishers = lazy(() => import('./pages/Publishers'));

// Personal Planning Module
const PersonalPlanningDashboard = lazy(
  () => import('./pages/PersonalPlanningDashboard')
);
const RoutineTasks = lazy(() => import('./pages/RoutineTasks'));
const Goals = lazy(() => import('./pages/Goals'));
const TodayTasks = lazy(() => import('./pages/TodayTasks'));

// Vaults Module (Cofres e Metas)
const Vaults = lazy(() => import('./pages/Vaults'));
const FinancialGoals = lazy(() => import('./pages/FinancialGoals'));

// Budgets Module
const Budgets = lazy(() => import('./pages/Budgets'));

// Bank Reconciliation Detail (navigated from Accounts page)
const BankReconciliationDetail = lazy(() => import('./pages/BankReconciliationDetail'));

// Loading component
const LoadingFallback = () => (
  <div className="flex h-screen items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-primary" />
  </div>
);

function AnimatedRoutes() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Register />}
        />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/share/:token" element={<ShareCredential />} />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Layout />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route
            path="/"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Home />
              </Suspense>
            }
          />
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/accounts"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Accounts />
              </Suspense>
            }
          />
          <Route
            path="/expenses"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Expenses />
              </Suspense>
            }
          />
          <Route
            path="/fixed-expenses"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <FixedExpenses />
              </Suspense>
            }
          />
          <Route
            path="/categorization-rules"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <CategorizationRules />
              </Suspense>
            }
          />
          <Route
            path="/revenues"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Revenues />
              </Suspense>
            }
          />
          <Route
            path="/credit-cards"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <CreditCards />
              </Suspense>
            }
          />
          <Route
            path="/credit-card-bills"
            element={<Navigate to="/credit-cards" replace />}
          />
          <Route
            path="/credit-card-expenses"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <CreditCardExpenses />
              </Suspense>
            }
          />
          <Route
            path="/transfers"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Transfers />
              </Suspense>
            }
          />
          <Route
            path="/loans"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Loans />
              </Suspense>
            }
          />
          <Route
            path="/payables"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Payables />
              </Suspense>
            }
          />
          <Route
            path="/members"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Members />
              </Suspense>
            }
          />
          <Route
            path="/members/:id/report"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <MemberFinancialReport />
              </Suspense>
            }
          />

          {/* Security Module routes */}
          <Route
            path="/security/dashboard"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <SecurityDashboard />
              </Suspense>
            }
          />
          <Route
            path="/security/passwords"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Passwords />
              </Suspense>
            }
          />
          <Route
            path="/security/stored-cards"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <StoredCards />
              </Suspense>
            }
          />
          <Route
            path="/security/stored-accounts"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <StoredAccounts />
              </Suspense>
            }
          />
          <Route
            path="/security/archives"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Archives />
              </Suspense>
            }
          />
          {/* Library Module routes */}
          <Route
            path="/library/dashboard"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <LibraryDashboard />
              </Suspense>
            }
          />
          <Route
            path="/library/books"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Books />
              </Suspense>
            }
          />
          <Route
            path="/library/authors"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Authors />
              </Suspense>
            }
          />
          <Route
            path="/library/publishers"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Publishers />
              </Suspense>
            }
          />
          {/* Personal Planning Module routes */}
          <Route
            path="/planning/dashboard"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <PersonalPlanningDashboard />
              </Suspense>
            }
          />
          <Route
            path="/planning/routine-tasks"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <RoutineTasks />
              </Suspense>
            }
          />
          <Route
            path="/planning/goals"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Goals />
              </Suspense>
            }
          />
          <Route
            path="/planning/daily"
            element={<Navigate to="/planning/today-tasks" replace />}
          />
          <Route
            path="/planning/today-tasks"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <TodayTasks />
              </Suspense>
            }
          />

          {/* Budgets Module routes */}
          <Route
            path="/budgets"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Budgets />
              </Suspense>
            }
          />

          {/* Bank Reconciliation Detail (accessed from Accounts) */}
          <Route
            path="/bank-reconciliation"
            element={<Navigate to="/accounts" replace />}
          />
          <Route
            path="/bank-reconciliation/:importId"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <BankReconciliationDetail />
              </Suspense>
            }
          />

          {/* Vaults Module routes (Cofres e Metas) */}
          <Route
            path="/vaults"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Vaults />
              </Suspense>
            }
          />
          <Route
            path="/financial-goals"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <FinancialGoals />
              </Suspense>
            }
          />
          <Route path="/vaults/simulator" element={<Navigate to="/vaults" replace />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const { loadUserData, isInitializing } = useAuthStore();

  useEffect(() => {
    // Load user data from cookies on app start
    void loadUserData();
  }, [loadUserData]);

  // Mostra loading durante inicialização
  if (isInitializing) {
    return <LoadingFallback />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AnimatedRoutes />
        <Toaster />
        <AlertDialogProvider />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
