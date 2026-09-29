import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { PageContainer } from './components/layout/PageContainer';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './pages/LandingPage';
import { StudentLoginPage } from './pages/student/StudentLoginPage';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { BookLaundryPage } from './pages/student/BookLaundryPage';
import { LaundryHistoryPage } from './pages/student/LaundryHistoryPage';
import { StaffLoginPage } from './pages/staff/StaffLoginPage';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { Role } from './types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: Role;
  loginPath: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRole,
  loginPath,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner text="Authenticating session..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={loginPath} replace />;
  }

  if (user.role !== allowedRole) {
    if (user.role === 'STUDENT') return <Navigate to="/student/dashboard" replace />;
    if (user.role === 'STAFF') return <Navigate to="/staff/dashboard" replace />;
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Staff dashboard: full-page layout with its own header */}
          <Route
            path="/staff/dashboard"
            element={
              <ProtectedRoute allowedRole="STAFF" loginPath="/staff/login">
                <StaffDashboard />
              </ProtectedRoute>
            }
          />

          {/* All other routes: shared Navbar + PageContainer + Footer */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
                <Navbar />
                <PageContainer>
                  <Routes>
                    {/* Public */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/student/login" element={<StudentLoginPage />} />
                    <Route path="/staff/login" element={<StaffLoginPage />} />
                    <Route path="/admin/login" element={<AdminLoginPage />} />

                    {/* Protected Student */}
                    <Route
                      path="/student/dashboard"
                      element={
                        <ProtectedRoute allowedRole="STUDENT" loginPath="/student/login">
                          <StudentDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/student/book"
                      element={
                        <ProtectedRoute allowedRole="STUDENT" loginPath="/student/login">
                          <BookLaundryPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/student/history"
                      element={
                        <ProtectedRoute allowedRole="STUDENT" loginPath="/student/login">
                          <LaundryHistoryPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Protected Admin */}
                    <Route
                      path="/admin/dashboard"
                      element={
                        <ProtectedRoute allowedRole="ADMIN" loginPath="/admin/login">
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </PageContainer>
                <Footer />
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
