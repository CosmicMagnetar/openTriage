import { useEffect, useCallback, useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import useAuthStore from "./stores/authStore";
import SplashScreen from "./components/SplashScreen";
import LandingPage from "./components/LandingPage";
import { Toaster } from "./components/ui/sonner";
import "./App.css";

// Lazy-load heavy components that are only needed post-login
const AuthPage = lazy(() => import("./components/AuthPage"));
const WorkspaceLayout = lazy(() => import("./components/workspace/WorkspaceLayout"));
const PublicProfile = lazy(() => import('./components/PublicProfile'));

/** The opening screen stays up at least this long, then fades out. */
const INTRO_MS = 1200;

/**
 * Fades between the app's sections (landing, dashboard, public profile).
 * Moving around inside the dashboard doesn't fade the whole page.
 */
function AnimatedRoutes({ children }) {
  const location = useLocation();
  const section = location.pathname.startsWith("/dashboard") ? "/dashboard" : location.pathname;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={section}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <Routes location={location}>{children}</Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), INTRO_MS);
    return () => clearTimeout(t);
  }, []);

  const {
    user,
    isLoading,
    isLoggingOut,
    loadUser,
    logout: storeLogout,
  } = useAuthStore();

  // Enhanced logout that handles cleanup properly
  const handleLogout = useCallback(() => {
    // Now trigger the store logout
    storeLogout();
  }, [storeLogout]);

  // Expose logout handler globally for sidebars
  useEffect(() => {
    window.handleLogout = handleLogout;
    return () => {
      delete window.handleLogout;
    };
  }, [handleLogout]);

  useEffect(() => {
    // Don't load user if we're logging out
    if (isLoggingOut) {
      return;
    }

    // OAuth callback hands the token over in the URL fragment (#token=...),
    // which never reaches servers or Referer headers. Errors come as ?error=.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hashParams.get("token");
    const error = new URLSearchParams(window.location.search).get("error");

    // Handle OAuth errors: tell the user and leave the splash screen.
    if (error) {
      console.error("OAuth error:", error);
      window.history.replaceState({}, document.title, window.location.pathname);
      toast.error(
        error === "access_denied"
          ? "GitHub sign-in was cancelled."
          : "GitHub sign-in failed. Please try again."
      );
      useAuthStore.setState({ isLoading: false });
      return;
    }

    // Check if we're on a logout-sensitive path (landing/login page after logout)
    const isLogoutPath =
      window.location.pathname === "/" || window.location.pathname === "/login";
    const hasStoredToken = localStorage.getItem("token");

    // If no token and on landing page, skip API call and show landing immediately
    if (!hasStoredToken && !token && isLogoutPath) {
      useAuthStore.setState({ isLoading: false });
      return;
    }

    if (token) {
      localStorage.setItem("token", token);
      // Clean URL immediately - redirect to dashboard
      window.history.replaceState({}, document.title, "/dashboard");
    }
    // Now load user (will use token from localStorage if present)
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggingOut]);  // Only isLoggingOut in deps - loadUser should be stable

  if (isLoading || !introDone) {
    return <SplashScreen immediate />;
  }

  // Not logged in - show landing or auth page
  if (!user) {
    return (
      <>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Suspense fallback={<SplashScreen />}>
            <AnimatedRoutes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/u/:login" element={<PublicProfile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </AnimatedRoutes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </>
    );
  }

  // Logged in. Workspace is never missing: the backend normalizes it, and
  // anything other than MAINTAINER falls back to the contributor workspace.
  return (
    <>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Suspense fallback={<SplashScreen />}>
          <AnimatedRoutes>
            <Route path="/" element={<LandingPage />} />
            {/* One shell for both workspaces; role picks the nav and data. */}
            <Route path="/dashboard/*" element={<WorkspaceLayout />} />
            <Route path="/u/:login" element={<PublicProfile />} />
            {/* Catch all unauthorized routes - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </AnimatedRoutes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
