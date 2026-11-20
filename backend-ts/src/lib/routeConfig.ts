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
    // GitHub calls this without a bearer token; it is authenticated by HMAC signature instead.
    '/api/webhooks/github',
    // Curated program list and its .ics feed: same for everyone, fetched by calendar apps without a token.
    '/api/programs',
    // README badge (SVG) and the browser extension's issue lookup: public GitHub data only.
    '/api/badge',
    '/api/public',
    // Daily opportunities sync, called by server.js with an internal key (checked in the route).
    '/api/internal',
    // Public profile pages: 404 unless the owner turned the link on.
    '/api/u',
];

// Routes that require MAINTAINER role
export const maintainerOnlyRoutes: string[] = [
    '/api/maintainer',
    '/api/repositories',
];

// Routes that require CONTRIBUTOR role
export const contributorOnlyRoutes: string[] = [
    '/api/contributor',
];

// Routes accessible by any authenticated user
export const authenticatedRoutes: string[] = [
    '/api/auth/me',
    '/api/auth/select-role',
    '/api/ai',
    '/api/rag',
    '/api/user',
    '/api/work',
    '/api/repo-lens',
    '/api/next-actions',
    '/api/journey',
    '/api/profile',
    '/api/sync',  // Both maintainers and contributors can sync
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
