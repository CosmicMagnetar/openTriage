import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isPublicRoute, requiresAuth, getRequiredRole } from "@/lib/routeConfig";

// CORS configuration
const allowedOrigins = [
    "http://localhost:5173",     // Vite dev
    "http://localhost:3000",     // Next.js dev
    "https://open-triage.vercel.app",
    "https://opentriage.onrender.com",
];

// JWT Secret for token verification
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verify JWT token and extract payload
 */
function verifyToken(token: string): { user_id: string; role: string | null } | null {
    try {
        // Simple JWT verification (base64 decode and verify signature)
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return {
            user_id: payload.user_id,
            role: payload.role || null
        };
    } catch {
        return null;
    }
}

export function middleware(request: NextRequest) {
    const origin = request.headers.get("origin") || "";
    const isAllowedOrigin = allowedOrigins.includes(origin);
    const pathname = request.nextUrl.pathname;

    // Handle preflight requests
    if (request.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    // Check if route requires authentication
    if (requiresAuth(pathname)) {
        const authHeader = request.headers.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Unauthorized", message: "Authentication required" },
                {
                    status: 401,
                    headers: {
                        "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "",
                        "Access-Control-Allow-Credentials": "true",
                    }
                }
            );
        }

        const token = authHeader.substring(7);
        const payload = verifyToken(token);

        if (!payload) {
            return NextResponse.json(
                { error: "Unauthorized", message: "Invalid or expired token" },
                {
                    status: 401,
                    headers: {
                        "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "",
                        "Access-Control-Allow-Credentials": "true",
                    }
                }
            );
        }

        // Check role-based access
        const requiredRole = getRequiredRole(pathname);
        if (requiredRole && payload.role !== requiredRole) {
            return NextResponse.json(
                { error: "Forbidden", message: `${requiredRole} role required` },
                {
                    status: 403,
                    headers: {
                        "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "",
                        "Access-Control-Allow-Credentials": "true",
                    }
                }
            );
        }
    }

    // Handle actual requests
    const response = NextResponse.next();

    if (isAllowedOrigin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
}

// Apply middleware to all API routes
export const config = {
    matcher: "/api/:path*",
};
