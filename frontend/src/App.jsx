import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/layout/Layout';
import PageLoader from './components/ui/PageLoader';
import LoginPage from './pages/LoginPage';
import SelectionPage from './pages/SelectionPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import PCBTypesPage from './pages/PCBTypesPage';
import ProductionPage from './pages/ProductionPage';
import ProcurementPage from './pages/ProcurementPage';
import ReportsPage from './pages/ReportsPage';

// Redirect authenticated users away from /login
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/select" replace /> : children;
}

// Protect routes that require authentication (no Layout)
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public — login */}
            <Route path="/login" element={
              <PublicRoute>
                <PageLoader>
                  <LoginPage />
                </PageLoader>
              </PublicRoute>
            } />

            {/* Protected — module selection (no sidebar) */}
            <Route path="/select" element={
              <PrivateRoute>
                <SelectionPage />
              </PrivateRoute>
            } />

            {/* Protected — all sections share the Layout (sidebar) */}
            <Route element={
              <PageLoader>
                <Layout />
              </PageLoader>
            }>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/pcb-types" element={<PCBTypesPage />} />
              <Route path="/production" element={<ProductionPage />} />
              <Route path="/procurement" element={<ProcurementPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
