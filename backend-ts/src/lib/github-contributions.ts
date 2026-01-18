/**
 * GitHub Contributions Fetcher
 * 
 * Fetches user contribution data from GitHub's GraphQL API
 * for displaying the contribution graph like GitHub does.
 */

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// Cache for contribution data (5 minute TTL for fresher data)
const contributionCache = new Map<string, { data: ContributionData; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface ContributionDay {
    date: string;
    contributionCount: number;
    contributionLevel: 'NONE' | 'FIRST_QUARTILE' | 'SECOND_QUARTILE' | 'THIRD_QUARTILE' | 'FOURTH_QUARTILE';
}

export interface ContributionWeek {
    contributionDays: ContributionDay[];
}

export interface ContributionData {
    totalContributions: number;
    weeks: ContributionWeek[];
}

/**
 * Fetch contribution calendar from GitHub GraphQL API
 * @param username - GitHub username
 * @param githubToken - Optional user's GitHub access token
 * @param year - Optional year to fetch contributions for (defaults to current year's 365 days)
 */
export async function fetchGitHubContributions(
    username: string,
    githubToken?: string | null,
    year?: number
): Promise<ContributionData | null> {
    // Check cache first (include year in cache key)
    const cacheKey = year ? `contributions:${username}:${year}` : `contributions:${username}`;
    const cached = contributionCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
        console.log(`[GitHub] Cache HIT for ${username} year=${year || 'current'}`);
        return cached.data;
    }

    console.log(`[GitHub] Fetching contributions for ${username} year=${year || 'current'}`);

    // Calculate date range for the query
    let fromDate: string | undefined;
    let toDate: string | undefined;

    if (year) {
        fromDate = `${year}-01-01T00:00:00Z`;
        toDate = `${year}-12-31T23:59:59Z`;
    }

    // GitHub GraphQL query for contribution calendar with optional date range
    const query = `
    query($username: String!${year ? ', $from: DateTime!, $to: DateTime!' : ''}) {
      user(login: $username) {
        contributionsCollection${year ? '(from: $from, to: $to)' : ''} {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

    // Use provided token or fall back to app token for public data
    const token = githubToken || process.env.GITHUB_TOKEN;
    const tokenSource = githubToken ? 'user token (includes private contributions)' : 'app token (public only)';

    if (!token) {
        console.warn('[GitHub] No token available for contributions fetch');
        return null;
    }

    console.log(`[GitHub] Using ${tokenSource} for ${username}, year=${year || 'default'}`);

    try {
        // Build variables object, including from/to dates if year is specified
        const variables: { username: string; from?: string; to?: string } = { username };
        if (year && fromDate && toDate) {
            variables.from = fromDate;
            variables.to = toDate;
        }

        const response = await fetch(GITHUB_GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables
            })
        });

        if (!response.ok) {
            console.error(`[GitHub] API error: ${response.status}`);
            return null;
        }

        // Log the token scopes for debugging
        const scopesHeader = response.headers.get('x-oauth-scopes');
        console.log(`[GitHub] Token scopes: ${scopesHeader}`);

        const result = await response.json();

        if (result.errors) {
            console.error('[GitHub] GraphQL errors:', result.errors);
            return null;
        }

        const calendar = result.data?.user?.contributionsCollection?.contributionCalendar;
        if (!calendar) {
            console.warn(`[GitHub] No contribution data for ${username}`);
            return null;
        }

        const data: ContributionData = {
            totalContributions: calendar.totalContributions,
            weeks: calendar.weeks
        };

        // Cache the result
        contributionCache.set(cacheKey, {
            data,
            expires: Date.now() + CACHE_TTL
        });

        console.log(`[GitHub] Fetched ${data.totalContributions} contributions for ${username}`);
        return data;

    } catch (error) {
        console.error('[GitHub] Fetch error:', error);
        return null;
    }
}

/**
 * Calculate streak from contribution data
 */
export function calculateStreakFromContributions(data: ContributionData): {
    currentStreak: number;
    longestStreak: number;
    isActive: boolean;
    totalContributionDays: number;
} {
    // Flatten all days and sort by date (most recent first)
    const allDays = data.weeks
        .flatMap(w => w.contributionDays)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const today = new Date().toISOString().substring(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);

    // Count total days with contributions
    const totalContributionDays = allDays.filter(d => d.contributionCount > 0).length;

    // Calculate current streak
    let currentStreak = 0;
    let isActive = false;
    let startIdx = 0;

    // Find starting point (today or yesterday)
    if (allDays[0]?.date === today && allDays[0].contributionCount > 0) {
        isActive = true;
        startIdx = 0;
    } else if (allDays[1]?.date === yesterday && allDays[1].contributionCount > 0) {
        // Yesterday had contributions, streak continues but need to contribute today
        isActive = false;
        startIdx = 1;
    } else if (allDays[0]?.date === today && allDays[0].contributionCount === 0 &&
        allDays[1]?.date === yesterday && allDays[1].contributionCount > 0) {
        // Today no contribution but yesterday had
        isActive = false;
        startIdx = 1;
    } else {
        // Streak is broken
        return {
            currentStreak: 0,
            longestStreak: calculateLongest(allDays),
            isActive: false,
            totalContributionDays
        };
    }

    // Count consecutive days
    for (let i = startIdx; i < allDays.length; i++) {
        if (allDays[i].contributionCount > 0) {
            // Check if this is consecutive with the previous counted day
            if (i === startIdx) {
                currentStreak = 1;
            } else {
                const prevDate = new Date(allDays[i - 1].date);
                const currDate = new Date(allDays[i].date);
                const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);

                if (diffDays === 1) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        } else if (i > startIdx) {
            // Hit a day with no contributions after streak started
            break;
        }
    }

    return {
        currentStreak,
        longestStreak: Math.max(currentStreak, calculateLongest(allDays)),
        isActive,
        totalContributionDays
    };
}

function calculateLongest(days: ContributionDay[]): number {
    // Sort ascending by date
    const sorted = [...days].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let longest = 0;
    let current = 0;

    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].contributionCount > 0) {
            if (i === 0) {
                current = 1;
            } else {
                const prevDate = new Date(sorted[i - 1].date);
                const currDate = new Date(sorted[i].date);
                const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / 86400000);

                if (diffDays === 1 && sorted[i - 1].contributionCount > 0) {
                    current++;
                } else {
                    current = 1;
                }
            }
            longest = Math.max(longest, current);
        } else {
            current = 0;
        }
    }

    return longest;
}

/**
 * Convert GitHub contribution levels to intensity values (0-4) like GitHub
 */
export function contributionLevelToIntensity(level: string): number {
    switch (level) {
        case 'FOURTH_QUARTILE': return 4;
        case 'THIRD_QUARTILE': return 3;
        case 'SECOND_QUARTILE': return 2;
        case 'FIRST_QUARTILE': return 1;
        default: return 0;
    }
}
