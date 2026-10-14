import { useState } from "react";
import { ArrowRight, BookOpen, LockKeyhole, UserRound } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const { user, isLoading, signIn, signUp, authError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = new URLSearchParams(location.search).get("next");
  const destination = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : "/my-blogs";

  if (!isLoading && user) return <Navigate to={destination} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const credentials = { username, password };
      if (isSignup) await signUp(credentials);
      else await signIn(credentials);
      navigate(destination, { replace: true });
    } catch (requestError) {
      console.error("Account request failed:", requestError);
      setError(requestError.response?.data?.error || "We couldn't complete that request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-emblem"><BookOpen size={21} /></div>
        <span className="eyebrow">{isSignup ? "Your writing journey begins" : "Welcome back"}</span>
        <h1>{isSignup ? "Make room for your ideas." : "Good to have you back."}</h1>
        <p className="auth-intro">
          {isSignup
            ? "Create an account to publish stories and follow how readers engage with them."
            : "Sign in to write, edit, and see how your stories are doing."}
        </p>

        {authError && <p className="auth-error" role="alert">{authError}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Username</span>
            <span className="auth-input-wrap">
              <UserRound size={17} />
              <input
                type="text"
                autoComplete="username"
                minLength={3}
                maxLength={30}
                pattern="(?:[A-Za-z0-9_.]|-){3,30}"
                title="Use 3–30 letters, numbers, dots, dashes, or underscores"
                placeholder="Your username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </span>
          </label>
          <label className="auth-field">
            <span>Password</span>
            <span className="auth-input-wrap">
              <LockKeyhole size={17} />
              <input
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={isSignup ? 8 : undefined}
                maxLength={128}
                placeholder={isSignup ? "At least 8 characters" : "Your password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </span>
          </label>
          <button className="auth-submit" type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New to Commonplace?"}{" "}
          <Link to={isSignup ? `/login${location.search}` : `/signup${location.search}`}>
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <Link to="/" className="auth-back-link">Continue reading without an account</Link>
      </section>
    </main>
  );
}

export default AuthPage;
