import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import ApiClient from "../services/api";
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const doVerify = async () => {
      if (!token) {
        setError("Verification token is missing from the URL.");
        setVerifying(false);
        return;
      }

      try {
        await ApiClient.post(`/auth/verify-email?token=${token}`, {});
        setSuccess(true);
      } catch (err: any) {
        setError(err.message || "Email verification failed. The token may have expired.");
      } finally {
        setVerifying(false);
      }
    };
    doVerify();
  }, [token]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background bg-glow-emerald px-4 relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md glass-card p-8 rounded-2xl relative z-10 text-center">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-3">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Email Verification</h2>
        </div>

        {verifying && (
          <div className="py-6 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm text-muted-foreground">Verifying your email address...</p>
          </div>
        )}

        {!verifying && success && (
          <div className="py-6 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <h3 className="text-lg font-semibold text-foreground">Email Verified!</h3>
            <p className="text-sm text-muted-foreground px-4">
              Your account has been successfully verified. You are now ready to explore Aetheria.
            </p>
          </div>
        )}

        {!verifying && error && (
          <div className="py-6 flex flex-col items-center gap-3">
            <XCircle className="w-12 h-12 text-red-400" />
            <h3 className="text-lg font-semibold text-foreground">Verification Failed</h3>
            <p className="text-sm text-red-400 px-4">{error}</p>
          </div>
        )}

        <div className="mt-6 border-t border-white/5 pt-6">
          <Link
            to="/login"
            className="inline-block px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
