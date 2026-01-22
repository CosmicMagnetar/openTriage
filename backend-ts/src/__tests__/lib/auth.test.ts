/**
 * Tests for authentication utilities
 */

import { createJwtToken, verifyJwtToken } from '@/lib/auth';

describe('Auth Utilities', () => {
    describe('createJwtToken', () => {
        it('should create a valid JWT token', () => {
            const token = createJwtToken('user-123', 'MAINTAINER');

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });

        it('should create token without role', () => {
            const token = createJwtToken('user-456', null);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });

        it('should include user_id in token payload', () => {
            const userId = 'test-user-id';
            const token = createJwtToken(userId, 'CONTRIBUTOR');
            const payload = verifyJwtToken(token);

            expect(payload.user_id).toBe(userId);
        });

        it('should include role in token payload', () => {
            const role = 'MAINTAINER';
            const token = createJwtToken('user-123', role);
            const payload = verifyJwtToken(token);

            expect(payload.role).toBe(role);
        });
    });

    describe('verifyJwtToken', () => {
        it('should verify a valid token', () => {
            const token = createJwtToken('user-123', 'MAINTAINER');
            const payload = verifyJwtToken(token);

            expect(payload.user_id).toBe('user-123');
            expect(payload.role).toBe('MAINTAINER');
        });

        it('should throw error for invalid token', () => {
            expect(() => {
                verifyJwtToken('invalid.token.here');
            }).toThrow('Invalid or expired token');
        });

        it('should throw error for malformed token', () => {
            expect(() => {
                verifyJwtToken('not-a-jwt');
            }).toThrow('Invalid or expired token');
        });

        it('should throw error for empty token', () => {
            expect(() => {
                verifyJwtToken('');
            }).toThrow('Invalid or expired token');
        });
    });
});
