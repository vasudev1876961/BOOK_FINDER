import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import PageTransition from "./components/PageTransition";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";
import BookDetails from "./pages/BookDetails";
import Shelves from "./pages/Shelves";
import AdminCatalog from "./pages/AdminCatalog";
import LibrarianChat from "./pages/LibrarianChat";
import Scanner from "./pages/Scanner";

// Initialize TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Routes>
            {/* Auth & Verification Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Protected Core App Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <Dashboard />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <Search />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/books/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <BookDetails />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/shelves"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <Shelves />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <LibrarianChat />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/scanner"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <Scanner />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <AdminCatalog />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Redirect fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
