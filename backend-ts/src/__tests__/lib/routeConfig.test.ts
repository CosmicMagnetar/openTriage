/**
 * Tests for route configuration utilities
 */

import {
    isPublicRoute,
    isMaintainerRoute,
    isContributorRoute,
    requiresAuth,
    getRequiredRole,
} from '@/lib/routeConfig';

describe('Route Configuration', () => {
    describe('isPublicRoute', () => {
        it('should return true for public routes', () => {
            expect(isPublicRoute('/api/auth/github')).toBe(true);
            expect(isPublicRoute('/api/auth/github/callback')).toBe(true);
            expect(isPublicRoute('/api/health')).toBe(true);
        });

        it('should return false for protected routes', () => {
            expect(isPublicRoute('/api/auth/me')).toBe(false);
            expect(isPublicRoute('/api/maintainer/dashboard')).toBe(false);
            expect(isPublicRoute('/api/contributor/issues')).toBe(false);
        });
    });

    describe('isMaintainerRoute', () => {
        it('should return true for maintainer routes', () => {
            expect(isMaintainerRoute('/api/maintainer')).toBe(true);
            expect(isMaintainerRoute('/api/maintainer/dashboard')).toBe(true);
            expect(isMaintainerRoute('/api/repositories')).toBe(true);
            expect(isMaintainerRoute('/api/sync')).toBe(true);
        });

        it('should return false for non-maintainer routes', () => {
            expect(isMaintainerRoute('/api/contributor')).toBe(false);
            expect(isMaintainerRoute('/api/auth/me')).toBe(false);
        });
    });

    describe('isContributorRoute', () => {
        it('should return true for contributor routes', () => {
            expect(isContributorRoute('/api/contributor')).toBe(true);
            expect(isContributorRoute('/api/contributor/issues')).toBe(true);
        });

        it('should return false for non-contributor routes', () => {
            expect(isContributorRoute('/api/maintainer')).toBe(false);
            expect(isContributorRoute('/api/auth/me')).toBe(false);
        });
    });

    describe('requiresAuth', () => {
        it('should return false for public routes', () => {
            expect(requiresAuth('/api/auth/github')).toBe(false);
            expect(requiresAuth('/api/health')).toBe(false);
        });

        it('should return true for protected API routes', () => {
            expect(requiresAuth('/api/auth/me')).toBe(true);
            expect(requiresAuth('/api/maintainer/dashboard')).toBe(true);
            expect(requiresAuth('/api/contributor/issues')).toBe(true);
            expect(requiresAuth('/api/chat')).toBe(true);
        });

        it('should return false for non-API routes', () => {
            expect(requiresAuth('/')).toBe(false);
            expect(requiresAuth('/dashboard')).toBe(false);
        });
    });

    describe('getRequiredRole', () => {
        it('should return MAINTAINER for maintainer routes', () => {
            expect(getRequiredRole('/api/maintainer')).toBe('MAINTAINER');
            expect(getRequiredRole('/api/maintainer/dashboard')).toBe('MAINTAINER');
            expect(getRequiredRole('/api/repositories')).toBe('MAINTAINER');
        });

        it('should return CONTRIBUTOR for contributor routes', () => {
            expect(getRequiredRole('/api/contributor')).toBe('CONTRIBUTOR');
            expect(getRequiredRole('/api/contributor/issues')).toBe('CONTRIBUTOR');
        });

        it('should return null for routes accessible by any authenticated user', () => {
            expect(getRequiredRole('/api/auth/me')).toBeNull();
            expect(getRequiredRole('/api/chat')).toBeNull();
            expect(getRequiredRole('/api/profile')).toBeNull();
        });
    });
});
