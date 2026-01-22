import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import SplashScreen from './SplashScreen';

/**
 * ProtectedRoute component
 * 
 * Wraps routes that require authentication.
 * Redirects to login if user is not authenticated.
 * Optionally checks for specific role requirements.
 */
const ProtectedRoute = ({
    children,
    requiredRole = null,  // 'MAINTAINER' | 'CONTRIBUTOR' | null
}) => {
    const { user, role, isLoading } = useAuthStore();
    const location = useLocation();

    // Show loading spinner while checking auth status
    if (isLoading) {
        return <SplashScreen />;
    }

    // Not authenticated - redirect to login
    if (!user) {
        // Save the attempted URL to redirect back after login
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check role requirement if specified
    if (requiredRole && role !== requiredRole) {
        // User doesn't have the required role
        // Redirect to dashboard or show forbidden
        return (
            <div className="min-h-screen bg-[hsl(220,13%,5%)] flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-[hsl(0,60%,60%)] mb-2">
                        Access Denied
                    </h1>
                    <p className="text-[hsl(210,11%,60%)]">
                        You need {requiredRole} access to view this page.
                    </p>
                    <a
                        href="/dashboard"
                        className="mt-4 inline-block text-[hsl(142,70%,55%)] hover:underline"
                    >
                        Return to Dashboard
                    </a>
                </div>
            </div>
        );
    }

    // Authenticated and has required role - render children
    return children;
};

export default ProtectedRoute;
