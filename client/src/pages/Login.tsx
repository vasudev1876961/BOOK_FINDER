import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ApiClient from "../services/api";
import { Mail, Lock, User as UserIcon, BookOpen, ArrowRight, AlertCircle, CheckCircle } from "lucide-react";

type FormMode = "login" | "register" | "forgot";

const Login: React.FC = () => {
  const [mode, setMode] = useState<FormMode>("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { login, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/";

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
        navigate(from, { replace: true });
      } else if (mode === "register") {
        await register(email, password, fullName);
        setMode("login");
        setPassword("");
        setSuccessMessage("Account created successfully! Please sign in below.");
      } else if (mode === "forgot") {
        await ApiClient.post("/auth/forgot-password", { email });
        setSuccessMessage("A password reset link has been logged to the server console!");
        setEmail("");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setSuccessMessage("");
    setSubmitting(true);
    try {
      // In local dev, we pass 'mock-google-token' which is handled on the backend to log in
      // a mock profile. In production, this would open Google One-Tap or Google Identity Client.
      await googleLogin("mock-google-token");
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Google authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center px-4 overflow-hidden">
      {/* Background glow highlights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-glow-emerald pointer-events-none opacity-60"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-glow-indigo pointer-events-none opacity-40"></div>

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            AETHERIA
          </span>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-8 border border-white/5 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
          
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2 text-center">
            {mode === "login" && "Sign In"}
            {mode === "register" && "Create Account"}
            {mode === "forgot" && "Reset Password"}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {mode === "login" && "Access your AI-powered library dashboard"}
            {mode === "register" && "Join the Aetheria reading community"}
            {mode === "forgot" && "Enter your email to receive a password reset link"}
          </p>

          {/* Feedback Messages */}
          {error && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs mb-4">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <p>{successMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    disabled={submitting}
                    className="w-full glass-input"
                  />
                  <UserIcon className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={submitting}
                  className="w-full glass-input"
                />
                <Mail className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Password
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError("");
                        setSuccessMessage("");
                      }}
                      className="text-xs text-primary hover:text-emerald-400 transition"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={submitting}
                    className="w-full glass-input"
                  />
                  <Lock className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {submitting ? (
                "Processing..."
              ) : (
                <>
                  {mode === "login" && "Sign In"}
                  {mode === "register" && "Get Started"}
                  {mode === "forgot" && "Send Reset Link"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social Sign In (Only for Login screen) */}
          {mode === "login" && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#141419]/90 px-3 text-muted-foreground tracking-wider font-semibold">
                    Or continue with
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 active:bg-white/15 text-foreground font-semibold rounded-xl border border-white/5 transition duration-200 cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>
            </>
          )}

          {/* Card footer toggle links */}
          <div className="mt-8 text-center text-xs text-muted-foreground">
            {mode === "login" && (
              <p>
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setSuccessMessage("");
                  }}
                  className="text-primary hover:underline font-semibold ml-1 cursor-pointer"
                >
                  Create one
                </button>
              </p>
            )}

            {mode === "register" && (
              <p>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setSuccessMessage("");
                  }}
                  className="text-primary hover:underline font-semibold ml-1 cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            )}

            {mode === "forgot" && (
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccessMessage("");
                }}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                Return to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
