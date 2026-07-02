import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute, { GuestRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AlertsPage from './pages/AlertsPage';
import ForensicsPage from './pages/ForensicsPage';
import CrisisRoomPage from './pages/CrisisRoomPage';
import RssiViewPage from './pages/RssiViewPage';
import UebaPage from './pages/UebaPage';
import CorrelationRulesPage from './pages/CorrelationRulesPage';
import UserAdminPage from './pages/UserAdminPage';
import ReportsPage from './pages/ReportsPage';
import ForbiddenPage from './pages/ForbiddenPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Routes publiques */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute allowAuthenticated={true}><RegisterPage /></GuestRoute>} />

          {/* Routes protégées */}
          <Route path="/dashboard" element={<ProtectedRoute path="/dashboard"><DashboardPage /></ProtectedRoute>} />
          <Route path="/alertes" element={<ProtectedRoute path="/alertes"><AlertsPage /></ProtectedRoute>} />
          <Route path="/forensique" element={<ProtectedRoute path="/forensique"><ForensicsPage /></ProtectedRoute>} />
          <Route path="/crisis-room" element={<ProtectedRoute path="/crisis-room"><CrisisRoomPage /></ProtectedRoute>} />
          <Route path="/rssi" element={<ProtectedRoute path="/rssi"><RssiViewPage /></ProtectedRoute>} />
          <Route path="/ueba" element={<ProtectedRoute path="/ueba"><UebaPage /></ProtectedRoute>} />
          <Route path="/regles" element={<ProtectedRoute path="/regles"><CorrelationRulesPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute path="/admin"><UserAdminPage /></ProtectedRoute>} />
          <Route path="/rapports" element={<ProtectedRoute path="/rapports"><ReportsPage /></ProtectedRoute>} />
          <Route path="/403" element={<ProtectedRoute><ForbiddenPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
