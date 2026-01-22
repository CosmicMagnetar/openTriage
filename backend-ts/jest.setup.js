// Jest setup file
// Configure test environment and mock dependencies

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.TURSO_DATABASE_URL = 'file:test.db';
process.env.TURSO_AUTH_TOKEN = 'test-token';

// Increase timeout for async tests
jest.setTimeout(10000);

// Mock the database module
jest.mock('@/db', () => ({
    db: {
        select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([])
                })
            })
        }),
        insert: jest.fn().mockReturnValue({
            values: jest.fn().mockResolvedValue({})
        }),
        update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue({})
            })
        }),
    }
}));
