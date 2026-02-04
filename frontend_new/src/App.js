import { useEffect, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import useAuthStore from "./stores/authStore";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import LandingPage from "./components/LandingPage";
import RoleSelection from "./components/RoleSelection";
import MaintainerLayout from "./components/maintainer/MaintainerLayout";
import ContributorLayout from "./components/contributor/ContributorLayout";
import { Toaster } from "./components/ui/sonner";
import { refreshAblyClient } from "./lib/ably";
import { realtimeMessagingClient } from "./services/realtimeMessaging";
import "./App.css";

function App() {
  const {
    user,
    role,
    isLoading,
    isLoggingOut,
    loadUser,
    logout: storeLogout,
  } = useAuthStore();

  // Enhanced logout that handles cleanup properly
  const handleLogout = useCallback(() => {
    // Disconnect real-time services first
    try {
      realtimeMessagingClient.disconnect();
      refreshAblyClient();
    } catch (e) {
      console.debug("Cleanup during logout:", e);
    }

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

    // Check for token in URL (from OAuth callback) FIRST before loading user
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const error = urlParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("OAuth error:", error);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Check if we're on a logout-sensitive path (landing/login page after logout)
    const isLogoutPath =
      window.location.pathname === "/" || window.location.pathname === "/login";
    const hasStoredToken = localStorage.getItem("token");

    // If no token and on landing page, don't try to load user
    if (!hasStoredToken && !token && isLogoutPath) {
      return;
    }

    if (token) {
      localStorage.setItem("token", token);
      // Clean URL immediately - redirect to dashboard
      window.history.replaceState({}, document.title, "/dashboard");
    }
    // Now load user (will use token from localStorage if present)
    loadUser();
  }, [loadUser, isLoggingOut]);

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
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </>
    );
  }

  // Logged in but no role selected
  if (!role) {
    return <RoleSelection user={user} onRoleSelected={loadUser} />;
  }

  // Logged in with role
  return (
    <>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard/*"
            element={
              role === "MAINTAINER" ? (
                <MaintainerLayout />
              ) : (
                <ContributorLayout />
              )
            }
          />
          {/* Catch all unauthorized routes - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
