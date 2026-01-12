import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import SplashScreen from './SplashScreen';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setAuth, loadUser } = useAuthStore();

  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data.type === 'auth-success') {
        const token = event.data.token;
        localStorage.setItem('token', token);
        await loadUser();
        navigate('/');
      } else if (event.data.type === 'auth-error') {
        navigate('/');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [navigate, loadUser]);

  return <SplashScreen />;
};

export default AuthCallback;