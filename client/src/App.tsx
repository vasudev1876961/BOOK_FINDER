import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import PageTransition from "./components/PageTransition";

// Lazy-loaded route components for optimal code splitting & fast initial load
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Search = lazy(() => import("./pages/Search"));
const BookDetails = lazy(() => import("./pages/BookDetails"));
const Shelves = lazy(() => import("./pages/Shelves"));
const AdminCatalog = lazy(() => import("./pages/AdminCatalog"));
const LibrarianChat = lazy(() => import("./pages/LibrarianChat"));
const Scanner = lazy(() => import("./pages/Scanner"));

// Suspense Fallback Loader
const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
    <div className="relative w-12 h-12 mb-4">
      <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping"></div>
      <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-500 animate-spin"></div>
    </div>
    <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium animate-pulse">
      Loading view...
    </span>
  </div>
);

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
          <Suspense fallback={<RouteLoadingFallback />}>
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
        </Suspense>
      </AuthProvider>
    </Router>
  </QueryClientProvider>
);
};

export default App;
