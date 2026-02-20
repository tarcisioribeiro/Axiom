import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from './stores/auth-store';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { Toaster } from './components/ui/toaster';
import { AlertDialogProvider } from './components/providers/AlertDialogProvider';
import { Loader2 } from 'lucide-react';

// Eager load (páginas públicas carregadas imediatamente)
import Login from './pages/Login';
import Register from './pages/Register';
import Unauthorized from './pages/Unauthorized';

// Lazy load (páginas protegidas carregadas sob demanda)
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Expenses = lazy(() => import('./pages/Expenses'));
const FixedExpenses = lazy(() => import('./pages/FixedExpenses'));
const Revenues = lazy(() => import('./pages/Revenues'));
const CreditCards = lazy(() => import('./pages/CreditCards'));
const CreditCardBills = lazy(() => import('./pages/CreditCardBills'));
const CreditCardExpenses = lazy(() => import('./pages/CreditCardExpenses'));
const Transfers = lazy(() => import('./pages/Transfers'));
const Loans = lazy(() => import('./pages/Loans'));
const Payables = lazy(() => import('./pages/Payables'));
const Members = lazy(() => import('./pages/Members'));

// Security Module
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'));
const Passwords = lazy(() => import('./pages/Passwords'));
const StoredCards = lazy(() => import('./pages/StoredCards'));
const StoredAccounts = lazy(() => import('./pages/StoredAccounts'));
const Archives = lazy(() => import('./pages/Archives'));
const PasswordGeneratorPage = lazy(() => import('./pages/PasswordGeneratorPage'));

// Library Module
const LibraryDashboard = lazy(() => import('./pages/LibraryDashboard'));
const Books = lazy(() => import('./pages/Books'));
const Authors = lazy(() => import('./pages/Authors'));
const Publishers = lazy(() => import('./pages/Publishers'));
const Summaries = lazy(() => import('./pages/Summaries'));
const Readings = lazy(() => import('./pages/Readings'));

// Personal Planning Module
const PersonalPlanningDashboard = lazy(
  () => import('./pages/PersonalPlanningDashboard')
);
const RoutineTasks = lazy(() => import('./pages/RoutineTasks'));
const Goals = lazy(() => import('./pages/Goals'));
const DailyChecklist = lazy(() => import('./pages/DailyChecklist'));

// Vaults Module (Cofres e Metas)
const Vaults = lazy(() => import('./pages/Vaults'));
const FinancialGoals = lazy(() => import('./pages/FinancialGoals'));

// AI Assistant Module
const AiAssistant = lazy(() => import('./pages/AiAssistant'));

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
            element={
              <Suspense fallback={<LoadingFallback />}>
                <CreditCardBills />
              </Suspense>
            }
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
            path="/security/password-generator"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <PasswordGeneratorPage />
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
          <Route
            path="/library/summaries"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Summaries />
              </Suspense>
            }
          />
          <Route
            path="/library/readings"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Readings />
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
            element={
              <Suspense fallback={<LoadingFallback />}>
                <DailyChecklist />
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

          {/* AI Assistant Module */}
          <Route
            path="/ai-assistant"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <AiAssistant />
              </Suspense>
            }
          />
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
    <BrowserRouter>
      <AnimatedRoutes />
      <Toaster />
      <AlertDialogProvider />
    </BrowserRouter>
  );
}

export default App;
