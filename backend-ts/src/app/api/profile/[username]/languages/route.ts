/**
 * User Languages Route
 * 
 * GET /api/profile/[username]/languages
 * Fetches the user's top programming languages from GitHub
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { Octokit } from "@octokit/rest";

// Cache for language data (15 minute TTL)
const languageCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 15 * 60 * 1000;

interface LanguageStats {
    language: string;
    bytes: number;
    percentage: number;
    color: string;
}

// Language colors from GitHub
const LANGUAGE_COLORS: Record<string, string> = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Rust: '#dea584',
    Ruby: '#701516',
    PHP: '#4F5D95',
    'C++': '#f34b7d',
    C: '#555555',
    'C#': '#178600',
    Swift: '#F05138',
    Kotlin: '#A97BFF',
    Scala: '#c22d40',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Shell: '#89e051',
    Vue: '#41b883',
    Dart: '#00B4AB',
    R: '#198CE7',
    SCSS: '#c6538c',
    Haskell: '#5e5086',
    Lua: '#000080',
    Elixir: '#6e4a7e',
    Clojure: '#db5855',
    Julia: '#a270ba',
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params;

        if (!username) {
            return NextResponse.json({ error: "Username required" }, { status: 400 });
        }

        // Check cache
        const cacheKey = `languages:${username.toLowerCase()}`;
        const cached = languageCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
            return NextResponse.json(cached.data);
        }

        // Try to get user's GitHub token
        const userRecord = await db.select({ githubAccessToken: users.githubAccessToken })
            .from(users)
            .where(sql`LOWER(${users.username}) = LOWER(${username})`)
            .limit(1);

        const token = userRecord[0]?.githubAccessToken || process.env.GITHUB_TOKEN;

        if (!token) {
            return NextResponse.json({ error: "GitHub token not available" }, { status: 500 });
        }

        const octokit = new Octokit({ auth: token });

        // Fetch user's repositories
        const { data: repos } = await octokit.repos.listForUser({
            username,
            sort: 'updated',
            per_page: 50,
            type: 'all'
        });

        // Aggregate language bytes from all repos
        const languageBytes: Record<string, number> = {};
        let totalBytes = 0;

        // Fetch languages for each repo (limit to avoid rate limiting)
        const reposToFetch = repos.slice(0, 20);
        
        for (const repo of reposToFetch) {
            try {
                const { data: repoLanguages } = await octokit.repos.listLanguages({
                    owner: repo.owner.login,
                    repo: repo.name
                });

                for (const [lang, bytes] of Object.entries(repoLanguages)) {
                    languageBytes[lang] = (languageBytes[lang] || 0) + bytes;
                    totalBytes += bytes;
                }
            } catch (e) {
                // Skip repos that fail (private, etc.)
            }
        }

        // Convert to array and sort by bytes
        const languages: LanguageStats[] = Object.entries(languageBytes)
            .map(([language, bytes]) => ({
                language,
                bytes,
                percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
                color: LANGUAGE_COLORS[language] || '#8b949e'
            }))
            .sort((a, b) => b.bytes - a.bytes)
            .slice(0, 10); // Top 10 languages

        const result = {
            username,
            languages,
            topLanguage: languages[0]?.language || null,
            totalBytes,
            reposAnalyzed: reposToFetch.length,
            updatedAt: new Date().toISOString()
        };

        // Cache the result
        languageCache.set(cacheKey, {
            data: result,
            expires: Date.now() + CACHE_TTL
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Languages fetch error:", error);
        
        if (error.status === 404) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        
        return NextResponse.json({ error: "Failed to fetch languages" }, { status: 500 });
    }
}
