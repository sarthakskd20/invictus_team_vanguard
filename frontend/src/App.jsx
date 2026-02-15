import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/layout/Layout';
import PageLoader from './components/ui/PageLoader';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import PCBTypesPage from './pages/PCBTypesPage';
import ProductionPage from './pages/ProductionPage';
import ProcurementPage from './pages/ProcurementPage';
import ReportsPage from './pages/ReportsPage';

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={
              <PublicRoute>
                <PageLoader>
                  <LoginPage />
                </PageLoader>
              </PublicRoute>
            } />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
