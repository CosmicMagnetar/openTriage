/**
 * Route Configuration for Protected Routes
 * 
 * Defines which routes are public, which require authentication,
 * and which require specific roles.
 */

// Public routes - no authentication required
export const publicRoutes: string[] = [
    '/api/auth/github',
    '/api/auth/github/callback',
    '/api/health',
];

// Routes that require MAINTAINER role
export const maintainerOnlyRoutes: string[] = [
    '/api/maintainer',
    '/api/repositories',
    '/api/sync',
];

// Routes that require CONTRIBUTOR role
export const contributorOnlyRoutes: string[] = [
    '/api/contributor',
];

// Routes accessible by any authenticated user
export const authenticatedRoutes: string[] = [
    '/api/auth/me',
    '/api/auth/select-role',
    '/api/profile',
    '/api/messaging',
    '/api/messages',
    '/api/chat',
    '/api/ai',
    '/api/rag',
    '/api/mentor',
    '/api/badges',
    '/api/user',
];

/**
 * Check if a route is public (no auth required)
 */
export function isPublicRoute(pathname: string): boolean {
    return publicRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
    );
}

/**
 * Check if a route requires MAINTAINER role
 */
export function isMaintainerRoute(pathname: string): boolean {
    return maintainerOnlyRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
    );
}

/**
 * Check if a route requires CONTRIBUTOR role
 */
export function isContributorRoute(pathname: string): boolean {
    return contributorOnlyRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
    );
}

/**
 * Check if a route requires any authentication
 */
export function requiresAuth(pathname: string): boolean {
    // If it's public, no auth required
    if (isPublicRoute(pathname)) {
        return false;
    }

    // All API routes require auth by default
    if (pathname.startsWith('/api/')) {
        return true;
    }

    return false;
}

/**
 * Get required role for a route (null if any authenticated user can access)
 */
export function getRequiredRole(pathname: string): 'MAINTAINER' | 'CONTRIBUTOR' | null {
    if (isMaintainerRoute(pathname)) {
        return 'MAINTAINER';
    }
    if (isContributorRoute(pathname)) {
        return 'CONTRIBUTOR';
    }
    return null;
}
