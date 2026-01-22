import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import SplashScreen from './components/SplashScreen';
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import RoleSelection from './components/RoleSelection';
import MaintainerLayout from './components/maintainer/MaintainerLayout';
import ContributorLayout from './components/contributor/ContributorLayout';
import { Toaster } from './components/ui/sonner';
import './App.css';

function App() {
  const { user, role, isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    // Check for token in URL (from OAuth callback) FIRST before loading user
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      // Clean URL immediately - redirect to dashboard
      window.history.replaceState({}, document.title, '/dashboard');
    }
    // Now load user (will use token from localStorage if present)
    loadUser();
  }, [loadUser]);

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
              role === 'MAINTAINER' ? (
                <MaintainerLayout />
              ) : (
                <ContributorLayout />
              )
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;