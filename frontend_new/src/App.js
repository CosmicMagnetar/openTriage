import { useEffect, useCallback, lazy, Suspense } from "react";
import axios from "axios";
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
import { refreshAblyClient } from "./lib/ably";
import { realtimeMessagingClient } from "./services/realtimeMessaging";
import "./App.css";

// Lazy-load heavy components that are only needed post-login
const AuthPage = lazy(() => import("./components/AuthPage"));
const RoleSelection = lazy(() => import("./components/RoleSelection"));
const MaintainerLayout = lazy(() => import("./components/maintainer/MaintainerLayout"));
const ContributorLayout = lazy(() => import("./components/contributor/ContributorLayout"));

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

  // Logged in but no role selected - AUTO SELECT CONTRIBUTOR
  // This effectively removes the manual role selection screen
  useEffect(() => {
    if (user && !role && !isLoading) {
      const autoSelectRole = async () => {
        try {
          console.log("Auto-assigning CONTRIBUTOR role...");
          const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
          const response = await axios.post(`${API}/auth/select-role`, {
            role: "CONTRIBUTOR",
          });
          const { token } = response.data;
          if (token) {
            localStorage.setItem("token", token);
            axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
            // Reload user to get the new role and proceed to dashboard
            await loadUser();
          }
        } catch (error) {
          console.error("Auto-role selection failed:", error);
        }
      };
      autoSelectRole();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, isLoading]);

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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </>
    );
  }



  if (!role) {
    return <SplashScreen />;
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
        <Suspense fallback={<SplashScreen />}>
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
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
