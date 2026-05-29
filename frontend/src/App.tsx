/* eslint-disable max-lines */
import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { AdminRoute } from './components/common/AdminRoute';
import { EnvironmentBanner } from './components/common/EnvironmentBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { RouteProgressBar } from './components/common/RouteProgressBar';
import { AdminLayout } from './components/layout/AdminLayout';
import { Layout } from './components/layout/Layout';
import { AlertDialogProvider } from './components/providers/AlertDialogProvider';
import { Toaster } from './components/ui/toaster';
import { queryClient } from './lib/query-client';
// Eager load (páginas públicas carregadas imediatamente)
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import ShareCredential from './pages/ShareCredential';
import Unauthorized from './pages/Unauthorized';
import VerifyEmail from './pages/VerifyEmail';
import { useAuthStore } from './stores/auth-store';

// Lazy load (páginas protegidas carregadas sob demanda)
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Accounts = lazy(() => import('./pages/Accounts'));
const CategorizationRules = lazy(() => import('./pages/CategorizationRules'));
const Transactions = lazy(() => import('./pages/Transactions'));
const RecurringItems = lazy(() => import('./pages/RecurringItems'));
const PayablesReceivables = lazy(() => import('./pages/PayablesReceivables'));
const CreditCardManagement = lazy(() => import('./pages/CreditCardManagement'));
const Transfers = lazy(() => import('./pages/Transfers'));
const Loans = lazy(() => import('./pages/Loans'));
const Members = lazy(() => import('./pages/Members'));
const MemberFinancialReport = lazy(() => import('./pages/MemberFinancialReport'));

// Security Module
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'));
const Passwords = lazy(() => import('./pages/Passwords'));
const StoredCards = lazy(() => import('./pages/StoredCards'));
const StoredAccounts = lazy(() => import('./pages/StoredAccounts'));
const Archives = lazy(() => import('./pages/Archives'));
const VaultHealthReport = lazy(() => import('./pages/VaultHealthReport'));
const TwoFactorSetup = lazy(() => import('./pages/TwoFactorSetup'));

// Library / Intellect Module
const LibraryDashboard = lazy(() => import('./pages/LibraryDashboard'));
const Books = lazy(() => import('./pages/Books'));
const Authors = lazy(() => import('./pages/Authors'));
const Publishers = lazy(() => import('./pages/Publishers'));
const BookReader = lazy(() => import('./pages/BookReader'));
const Courses = lazy(() => import('./pages/Courses'));
const Skills = lazy(() => import('./pages/Skills'));
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraph'));

// Personal Planning Module
const PersonalPlanningDashboard = lazy(
  () => import('./pages/PersonalPlanningDashboard')
);
const TasksAndGoals = lazy(() => import('./pages/TasksAndGoals'));

// Vaults Module (Cofres e Metas)
const Vaults = lazy(() => import('./pages/Vaults'));
const FinancialGoals = lazy(() => import('./pages/FinancialGoals'));

// Budgets Module
const Budgets = lazy(() => import('./pages/Budgets'));

// Webhooks
const Webhooks = lazy(() => import('./pages/Webhooks'));

// Notification Preferences
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences'));

// User Profile / Settings
const UserProfile = lazy(() => import('./pages/UserProfile'));

// Bank Reconciliation
const BankReconciliation = lazy(() => import('./pages/BankReconciliation'));
const BankReconciliationDetail = lazy(() => import('./pages/BankReconciliationDetail'));
const BankStatementImport = lazy(() => import('./pages/BankStatementImport'));

// Vault Simulator
const VaultSimulator = lazy(() => import('./pages/VaultSimulator'));

// Security extras
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const PasswordImport = lazy(() => import('./pages/PasswordImport'));
const Permissions = lazy(() => import('./pages/Permissions'));

// Planning extras
const DailyChecklist = lazy(() => import('./pages/DailyChecklist'));
const DailyReflections = lazy(() => import('./pages/DailyReflections'));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage'));
const NutritionPage = lazy(() => import('./pages/NutritionPage'));

// Agents
const Agents = lazy(() => import('./pages/Agents'));

// Admin Panel
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminConfig = lazy(() => import('./pages/admin/AdminConfig'));
const AdminIntegrations = lazy(() => import('./pages/admin/AdminIntegrations'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));

const LoadingFallback = () => (
  <div className="flex h-screen items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-primary" />
  </div>
);

/**
 * Wraps every lazy-loaded page with its own ErrorBoundary + Suspense so a
 * page-level crash doesn't unmount the sidebar/header.
 */
const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
  </ErrorBoundary>
);

function AnimatedRoutes() {
  const location = useLocation();
  const { isAuthenticated, isAdmin } = useAuthStore();

  const loginRedirect = isAuthenticated ? (
    isAdmin ? (
      <Navigate to="/admin" replace />
    ) : (
      <Navigate to="/" replace />
    )
  ) : (
    <Login />
  );

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route path="/login" element={loginRedirect} />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Register />}
        />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/share/:token" element={<ShareCredential />} />
        <Route
          path="/forgot-password"
          element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />}
        />
        <Route
          path="/reset-password/:uid/:token"
          element={isAuthenticated ? <Navigate to="/" replace /> : <ResetPassword />}
        />
        <Route path="/verify-email" element={<VerifyEmail />} />

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
              <PageWrapper>
                <Home />
              </PageWrapper>
            }
          />
          <Route
            path="/dashboard"
            element={
              <PageWrapper>
                <Dashboard />
              </PageWrapper>
            }
          />
          <Route
            path="/accounts"
            element={
              <PageWrapper>
                <Accounts />
              </PageWrapper>
            }
          />
          <Route
            path="/transactions"
            element={
              <PageWrapper>
                <Transactions />
              </PageWrapper>
            }
          />
          <Route path="/expenses" element={<Navigate to="/transactions" replace />} />
          <Route path="/revenues" element={<Navigate to="/transactions" replace />} />
          <Route
            path="/recurring"
            element={
              <PageWrapper>
                <RecurringItems />
              </PageWrapper>
            }
          />
          <Route
            path="/fixed-expenses"
            element={<Navigate to="/recurring" replace />}
          />
          <Route
            path="/fixed-revenues"
            element={<Navigate to="/recurring" replace />}
          />
          <Route
            path="/categorization-rules"
            element={
              <PageWrapper>
                <CategorizationRules />
              </PageWrapper>
            }
          />
          <Route
            path="/credit-cards"
            element={
              <PageWrapper>
                <CreditCardManagement />
              </PageWrapper>
            }
          />
          <Route
            path="/credit-card-bills"
            element={<Navigate to="/credit-cards" replace />}
          />
          <Route
            path="/credit-card-expenses"
            element={<Navigate to="/credit-cards" replace />}
          />
          <Route
            path="/transfers"
            element={
              <PageWrapper>
                <Transfers />
              </PageWrapper>
            }
          />
          <Route
            path="/loans"
            element={
              <PageWrapper>
                <Loans />
              </PageWrapper>
            }
          />
          <Route
            path="/bills"
            element={
              <PageWrapper>
                <PayablesReceivables />
              </PageWrapper>
            }
          />
          <Route path="/payables" element={<Navigate to="/bills" replace />} />
          <Route path="/receivables" element={<Navigate to="/bills" replace />} />
          <Route
            path="/members"
            element={
              <PageWrapper>
                <Members />
              </PageWrapper>
            }
          />
          <Route
            path="/members/:id/report"
            element={
              <PageWrapper>
                <MemberFinancialReport />
              </PageWrapper>
            }
          />

          {/* Security Module routes */}
          <Route
            path="/security/dashboard"
            element={
              <PageWrapper>
                <SecurityDashboard />
              </PageWrapper>
            }
          />
          <Route
            path="/security/passwords"
            element={
              <PageWrapper>
                <Passwords />
              </PageWrapper>
            }
          />
          <Route
            path="/security/stored-cards"
            element={
              <PageWrapper>
                <StoredCards />
              </PageWrapper>
            }
          />
          <Route
            path="/security/stored-accounts"
            element={
              <PageWrapper>
                <StoredAccounts />
              </PageWrapper>
            }
          />
          <Route
            path="/security/archives"
            element={
              <PageWrapper>
                <Archives />
              </PageWrapper>
            }
          />
          <Route
            path="/security/activity-logs"
            element={
              <PageWrapper>
                <ActivityLogs />
              </PageWrapper>
            }
          />
          <Route
            path="/security/password-import"
            element={
              <PageWrapper>
                <PasswordImport />
              </PageWrapper>
            }
          />
          <Route
            path="/security/health"
            element={
              <PageWrapper>
                <VaultHealthReport />
              </PageWrapper>
            }
          />
          <Route
            path="/settings/two-factor"
            element={
              <PageWrapper>
                <TwoFactorSetup />
              </PageWrapper>
            }
          />
          {/* Library Module routes */}
          <Route
            path="/library/dashboard"
            element={
              <PageWrapper>
                <LibraryDashboard />
              </PageWrapper>
            }
          />
          <Route
            path="/library/books"
            element={
              <PageWrapper>
                <Books />
              </PageWrapper>
            }
          />
          <Route
            path="/library/authors"
            element={
              <PageWrapper>
                <Authors />
              </PageWrapper>
            }
          />
          <Route
            path="/library/publishers"
            element={
              <PageWrapper>
                <Publishers />
              </PageWrapper>
            }
          />
          <Route
            path="/library/courses"
            element={
              <PageWrapper>
                <Courses />
              </PageWrapper>
            }
          />
          <Route
            path="/library/skills"
            element={
              <PageWrapper>
                <Skills />
              </PageWrapper>
            }
          />
          <Route
            path="/library/knowledge-graph"
            element={
              <PageWrapper>
                <KnowledgeGraphPage />
              </PageWrapper>
            }
          />
          {/* Personal Planning Module routes */}
          <Route
            path="/planning/dashboard"
            element={
              <PageWrapper>
                <PersonalPlanningDashboard />
              </PageWrapper>
            }
          />
          <Route
            path="/planning/tasks-goals"
            element={
              <PageWrapper>
                <TasksAndGoals />
              </PageWrapper>
            }
          />
          <Route
            path="/planning/routine-tasks"
            element={<Navigate to="/planning/tasks-goals" replace />}
          />
          <Route
            path="/planning/goals"
            element={<Navigate to="/planning/tasks-goals" replace />}
          />
          <Route
            path="/planning/daily"
            element={<Navigate to="/planning/tasks-goals" replace />}
          />
          <Route
            path="/planning/today-tasks"
            element={<Navigate to="/planning/tasks-goals" replace />}
          />
          <Route
            path="/planning/daily-checklist"
            element={
              <PageWrapper>
                <DailyChecklist />
              </PageWrapper>
            }
          />
          <Route
            path="/planning/reflections"
            element={
              <PageWrapper>
                <DailyReflections />
              </PageWrapper>
            }
          />
          <Route
            path="/planning/workout"
            element={
              <PageWrapper>
                <WorkoutPage />
              </PageWrapper>
            }
          />
          <Route
            path="/planning/nutrition"
            element={
              <PageWrapper>
                <NutritionPage />
              </PageWrapper>
            }
          />

          {/* Budgets Module routes */}
          <Route
            path="/budgets"
            element={
              <PageWrapper>
                <Budgets />
              </PageWrapper>
            }
          />

          {/* Webhooks */}
          <Route
            path="/webhooks"
            element={
              <PageWrapper>
                <Webhooks />
              </PageWrapper>
            }
          />

          {/* Bank Reconciliation */}
          <Route
            path="/bank-reconciliation"
            element={
              <PageWrapper>
                <BankReconciliation />
              </PageWrapper>
            }
          />
          <Route
            path="/bank-reconciliation/:importId"
            element={
              <PageWrapper>
                <BankReconciliationDetail />
              </PageWrapper>
            }
          />
          <Route
            path="/bank-reconciliation/import"
            element={
              <PageWrapper>
                <BankStatementImport />
              </PageWrapper>
            }
          />

          {/* Vaults Module routes (Cofres e Metas) */}
          <Route
            path="/vaults"
            element={
              <PageWrapper>
                <Vaults />
              </PageWrapper>
            }
          />
          <Route
            path="/financial-goals"
            element={
              <PageWrapper>
                <FinancialGoals />
              </PageWrapper>
            }
          />
          <Route
            path="/vaults/simulator"
            element={
              <PageWrapper>
                <VaultSimulator />
              </PageWrapper>
            }
          />

          {/* Agents */}
          <Route
            path="/agents"
            element={
              <PageWrapper>
                <Agents />
              </PageWrapper>
            }
          />

          {/* Settings */}
          <Route
            path="/settings/profile"
            element={
              <PageWrapper>
                <UserProfile />
              </PageWrapper>
            }
          />
          <Route
            path="/settings/permissions"
            element={
              <PageWrapper>
                <Permissions />
              </PageWrapper>
            }
          />
          <Route
            path="/settings/notifications"
            element={
              <PageWrapper>
                <NotificationPreferences />
              </PageWrapper>
            }
          />
        </Route>

        {/* Book Reader — protected but without Layout (fullscreen) */}
        <Route
          path="/library/reader/:bookId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <PageWrapper>
                  <BookReader />
                </PageWrapper>
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Admin Panel routes — exclusivo para superusuários */}
        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route
            path="/admin"
            element={
              <PageWrapper>
                <AdminOverview />
              </PageWrapper>
            }
          />
          <Route
            path="/admin/config"
            element={
              <PageWrapper>
                <AdminConfig />
              </PageWrapper>
            }
          />
          <Route
            path="/admin/integrations"
            element={
              <PageWrapper>
                <AdminIntegrations />
              </PageWrapper>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <PageWrapper>
                <AdminLogs />
              </PageWrapper>
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <EnvironmentBanner />
        <RouteProgressBar />
        <AnimatedRoutes />
        <Toaster />
        <AlertDialogProvider />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
