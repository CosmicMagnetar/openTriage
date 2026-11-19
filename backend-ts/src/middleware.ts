import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isPublicRoute, requiresAuth, getRequiredRole } from "@/lib/routeConfig";

// CORS configuration
const allowedOrigins = [
    "http://localhost:5173",     // Vite dev
    "http://localhost:3000",     // Next.js dev
    "https://open-triage.vercel.app",
    "https://opentriage.onrender.com",
    "https://open-triage-6r2y.vercel.app", // Specific preview deployment
];

function base64UrlToBytes(input: string): Uint8Array {
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

let hmacKey: Promise<CryptoKey> | null = null;
function getKey(secret: string) {
    hmacKey ??= crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return hmacKey;
}

/**
 * Verify an HS256 JWT (signature + expiry) with Web Crypto, which works in the
 * edge runtime. Previously the payload was only base64-decoded, so the role
 * claim used for gating below could be forged.
 */
async function verifyToken(token: string): Promise<{ user_id: string; role: string | null } | null> {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    try {
        const [header, body, signature] = token.split(".");
        if (!header || !body || !signature) return null;
        if (JSON.parse(new TextDecoder().decode(base64UrlToBytes(header))).alg !== "HS256") return null;

        const ok = await crypto.subtle.verify(
            "HMAC",
            await getKey(secret),
            base64UrlToBytes(signature) as BufferSource,
            new TextEncoder().encode(`${header}.${body}`)
        );
        if (!ok) return null;

        const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return { user_id: payload.user_id, role: payload.role || null };
    } catch {
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const origin = request.headers.get("origin") || "";
    // Allow any Vercel preview deployment or listed origins
    const isAllowedOrigin = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
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
        const payload = await verifyToken(token);

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

        // Check role-based access (legacy/null roles count as CONTRIBUTOR)
        const requiredRole = getRequiredRole(pathname);
        const workspace = payload.role?.toUpperCase() === "MAINTAINER" ? "MAINTAINER" : "CONTRIBUTOR";
        if (requiredRole && workspace !== requiredRole) {
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
