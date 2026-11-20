import { useEffect, useCallback, lazy, Suspense } from "react";
import { toast } from "sonner";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import useAuthStore from "./stores/authStore";
import SplashScreen from "./components/SplashScreen";
import LandingPage from "./components/LandingPage";
import { Toaster } from "./components/ui/sonner";
import "./App.css";

// Lazy-load heavy components that are only needed post-login
const AuthPage = lazy(() => import("./components/AuthPage"));
const WorkspaceLayout = lazy(() => import("./components/workspace/WorkspaceLayout"));
const PublicProfile = lazy(() => import('./components/PublicProfile'));

function App() {
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

  if (isLoading) {
    return <SplashScreen />;
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
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/u/:login" element={<PublicProfile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
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
          <Routes>
            <Route path="/" element={<LandingPage />} />
            {/* One shell for both workspaces; role picks the nav and data. */}
            <Route path="/dashboard/*" element={<WorkspaceLayout />} />
            <Route path="/u/:login" element={<PublicProfile />} />
            {/* Catch all unauthorized routes - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
