import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import SplashScreen from './components/SplashScreen';
import AuthPage from './components/AuthPage';
import RoleSelection from './components/RoleSelection';
import MaintainerLayout from './components/maintainer/MaintainerLayout';
import ContributorLayout from './components/contributor/ContributorLayout';
import { Toaster } from './components/ui/sonner';
import './App.css';

function App() {
  const { user, role, isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();

    // Check for token in URL (from OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      loadUser();
      // Clean URL
      window.history.replaceState({}, document.title, '/');
    }
  }, [loadUser]);

  if (isLoading) {
    return <SplashScreen />;
  }

  // Not logged in
  if (!user) {
    return <AuthPage />;
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
          <Route
            path="/*"
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