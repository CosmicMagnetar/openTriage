/**
 * OpenTriage API Service
 * Centralized API client for all backend calls
 */

// Use VITE_BACKEND_URL for backend-ts (port 3001)
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Make an authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'API request failed');
  }
  
  return response.json();
}

// ============ Mentor Matching API ============

export const mentorApi = {
  findMentorsForUser: (userId, username, limit = 5, skills = null) => {
    let url = `/api/mentor/match/${userId}?username=${username}&limit=${limit}`;
    if (skills) {
      url += `&skills=${encodeURIComponent(skills)}`;
    }
    return apiRequest(url);
  },
  
  findMentorsForIssue: (issueId, limit = 5) =>
    apiRequest(`/api/mentor/match/issue/${issueId}?limit=${limit}`),
  
  createProfile: (userId, username, data) =>
    apiRequest(`/api/mentor/profile?user_id=${userId}&username=${username}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getProfile: (userId) =>
    apiRequest(`/api/mentor/profile/${userId}`),
  
  listMentors: (activeOnly = true, limit = 20) =>
    apiRequest(`/api/mentor/profiles?active_only=${activeOnly}&limit=${limit}`),
  
  requestMentorship: (menteeId, data) =>
    apiRequest(`/api/mentor/request?mentee_id=${menteeId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  rateMentor: (data) =>
    apiRequest('/api/mentor/rate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  analyzeTechStack: (username) =>
    apiRequest(`/api/mentor/tech-stack/${username}`),

  getMyMentors: () =>
    apiRequest('/api/mentor/my-mentors'),

  getMyPendingRequests: () =>
    apiRequest('/api/mentor/my-requests'),

  disconnectMentor: (mentorId) =>
    apiRequest(`/api/mentor/disconnect/${mentorId}`, {
      method: 'DELETE',
    }),
};

// ============ Trophy API ============

export const trophyApi = {
  getUserTrophies: (userId, username) =>
    apiRequest(`/api/trophy/user/${userId}?username=${username}`),
  
  getTrophy: (trophyId) =>
    apiRequest(`/api/trophy/${trophyId}`),
  
  getTrophySvg: (trophyId) =>
    `${API_BASE}/api/trophy/${trophyId}/svg`,
  
  checkAchievements: (userId, username) =>
    apiRequest(`/api/trophy/check?user_id=${userId}&username=${username}`, {
      method: 'POST',
    }),
  
  getLeaderboard: (limit = 10) =>
    apiRequest(`/api/trophy/leaderboard?limit=${limit}`),
  
  getTrophyTypes: () =>
    apiRequest('/api/trophy/types'),
};

// ============ RAG Chatbot API ============

export const ragApi = {
  askQuestion: (question, repoName = null, topK = 5, githubAccessToken = null) =>
    apiRequest('/api/rag/chat', {
      method: 'POST',
      body: JSON.stringify({ 
        question, 
        repo_name: repoName, 
        top_k: topK,
        github_access_token: githubAccessToken 
      }),
    }),
  
  searchDocuments: (query, repoName = null, limit = 10) =>
    apiRequest('/api/rag/search', {
      method: 'POST',
      body: JSON.stringify({ query, repo_name: repoName, limit }),
    }),
  
  indexRepository: (repoName) =>
    apiRequest('/api/rag/index', {
      method: 'POST',
      body: JSON.stringify({ repo_name: repoName }),
    }),
  
  getSuggestedQuestions: (repoName = null) =>
    apiRequest(`/api/rag/suggestions${repoName ? `?repo_name=${repoName}` : ''}`),
};

// ============ Mentorship Chat API ============

export const chatApi = {
  createSession: (data) =>
    apiRequest('/api/mentorship/session', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getSession: (sessionId) =>
    apiRequest(`/api/mentorship/session/${sessionId}`),
  
  getUserSessions: (userId, activeOnly = true) =>
    apiRequest(`/api/mentorship/sessions/${userId}?active_only=${activeOnly}`),
  
  getChatHistory: (sessionId, limit = 100) =>
    apiRequest(`/api/mentorship/session/${sessionId}/history?limit=${limit}`),
  
  sendMessage: (sessionId, senderId, senderUsername, data) =>
    apiRequest(`/api/mentorship/session/${sessionId}/message?sender_id=${senderId}&sender_username=${senderUsername}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  endSession: (sessionId) =>
    apiRequest(`/api/mentorship/session/${sessionId}/end`, { method: 'POST' }),
  
  getSessionSummary: (sessionId) =>
    apiRequest(`/api/mentorship/session/${sessionId}/summary`),
  
  // WebSocket URL generator
  getWebSocketUrl: (sessionId, userId) =>
    `${API_BASE.replace('http', 'ws')}/api/mentorship/ws/${sessionId}/${userId}`,
};

// ============ Community API (Nudges, Resources, Hype) ============

export const communityApi = {
  // Nudges
  getStuckContributors: () =>
    apiRequest('/api/community/nudges/stuck'),
  
  sendAllNudges: () =>
    apiRequest('/api/community/nudges/send-all', { method: 'POST' }),
  
  getNudgeHistory: (userId = null, issueId = null, limit = 20) => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (issueId) params.append('issue_id', issueId);
    params.append('limit', limit);
    return apiRequest(`/api/community/nudges/history?${params}`);
  },
  
  // Resources
  extractResources: (data) =>
    apiRequest('/api/community/resources/extract', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  searchResources: (data) =>
    apiRequest('/api/community/resources/search', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getResourcesForTopic: (topic, repoName = null) =>
    apiRequest(`/api/community/resources/topic/${topic}${repoName ? `?repo_name=${repoName}` : ''}`),
  
  getTrendingResources: (repoName = null, days = 7, limit = 10) => {
    const params = new URLSearchParams({ days, limit });
    if (repoName) params.append('repo_name', repoName);
    return apiRequest(`/api/community/resources/trending?${params}`);
  },
  
  markResourceHelpful: (resourceId, userId) =>
    apiRequest(`/api/community/resources/${resourceId}/helpful?user_id=${userId}`, { method: 'POST' }),
  
  // Hype Generator
  generateLinkedInPost: (data) =>
    apiRequest('/api/community/hype/linkedin', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  generateTwitterPost: (data) =>
    apiRequest('/api/community/hype/twitter', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getStatsCardUrl: (username) =>
    `${API_BASE}/api/community/hype/stats-card/${username}`,
};

// ============ Gamification API ============

export const gamificationApi = {
  getUserGamification: (username) =>
    apiRequest(`/api/spark/gamification/user/${username}`),
  
  getUserStreak: (username, days = 365) =>
    apiRequest(`/api/spark/gamification/streak/${username}?days=${days}`),
  
  getUserCalendar: (username, days = 365, year = null) => {
    let url = `/api/spark/gamification/calendar/${username}?days=${days}`;
    if (year) {
      url += `&year=${year}`;
    }
    return apiRequest(url);
  },
  
  getLeaderboard: (days = 30, limit = 10) =>
    apiRequest(`/api/spark/gamification/leaderboard?days=${days}&limit=${limit}`),
  
  // GitHub Events/Activity
  getUserEvents: (username, year = null) => {
    let url = `/api/github/events/${username}`;
    if (year) {
      url += `?year=${year}`;
    }
    return apiRequest(url);
  },
  
  // Badges
  getAllBadges: () =>
    apiRequest('/api/spark/badges/all'),
  
  getUserBadges: (username) =>
    apiRequest(`/api/spark/badges/user/${username}`),
  
  checkBadges: (username) =>
    apiRequest(`/api/spark/badges/check/${username}`, { method: 'POST' }),
};

// ============ Analytics API ============

export const analyticsApi = {
  getInvisibleLabor: (data) =>
    apiRequest('/api/spark/analytics/invisible-labor', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getTopContributors: (days = 90, limit = 10) =>
    apiRequest(`/api/spark/analytics/invisible-labor/top/${limit}?days=${days}`),
  
  getUserMetrics: (username, days = 90) =>
    apiRequest(`/api/spark/analytics/invisible-labor/user/${username}?days=${days}`),
  
  getRepoSummary: (owner, repo, days = 90) =>
    apiRequest(`/api/spark/analytics/invisible-labor/repo/${owner}/${repo}?days=${days}`),
};

// ============ Sentiment API ============

export const sentimentApi = {
  analyzeSentiment: (repoName = null, useCache = true) =>
    apiRequest('/api/spark/sentiment/analyze', {
      method: 'POST',
      body: JSON.stringify({ repo_name: repoName, use_cache: useCache }),
    }),
};

// ============ Cookie-Licking API ============

export const cookieLickingApi = {
  getStatus: (repoName = null) => {
    const params = repoName ? `?repo_name=${repoName}` : '';
    return apiRequest(`/api/spark/cookie-licking/status${params}`);
  },
  
  getAtRiskClaims: (repoName = null) => {
    const params = repoName ? `?repo_name=${repoName}` : '';
    return apiRequest(`/api/spark/cookie-licking/at-risk${params}`);
  },
  
  releaseExpired: () =>
    apiRequest('/api/spark/cookie-licking/release-expired', { method: 'POST' }),
  
  startScan: () =>
    apiRequest('/api/spark/cookie-licking/start-scan', { method: 'POST' }),
  
  stopScan: () =>
    apiRequest('/api/spark/cookie-licking/stop-scan', { method: 'POST' }),
};

// ============ Issue Claiming API ============

export const claimApi = {
  claimIssue: (issueId) =>
    apiRequest('/api/contributor/claim-issue', {
      method: 'POST',
      body: JSON.stringify({ issueId }),
    }),
  
  unclaimIssue: (issueId) =>
    apiRequest(`/api/contributor/claim-issue/${issueId}`, { method: 'DELETE' }),
  
  getMyClaimedIssues: () =>
    apiRequest('/api/contributor/my-claimed-issues'),
  
  updateClaimActivity: (issueId) =>
    apiRequest(`/api/contributor/claim-activity/${issueId}`, { method: 'POST' }),
};

// ============ Messaging API ============

export const messagingApi = {
  getHistory: (otherUserId) =>
    apiRequest(`/api/messaging/history/${otherUserId}`),
  
  sendMessage: (receiverId, content) =>
    apiRequest('/api/messaging/send', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: receiverId, content }),
    }),
  
  pollMessages: (otherUserId, lastMessageId = null) => {
    const params = lastMessageId ? `?last_message_id=${lastMessageId}` : '';
    return apiRequest(`/api/messaging/poll/${otherUserId}${params}`);
  },

  getConversations: () =>
    apiRequest('/api/messaging/conversations'),

  markRead: (otherUserId) =>
    apiRequest(`/api/messaging/mark-read/${otherUserId}`, { method: 'POST' }),

  // Mentorship Management
  getMentorshipRequests: () =>
    apiRequest('/api/messaging/mentorship/requests'),

  acceptMentorship: (requestId, message = null) =>
    apiRequest('/api/messaging/mentorship/accept', {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId, message }),
    }),

  declineMentorship: (requestId) =>
    apiRequest('/api/messaging/mentorship/decline', {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId }),
    }),

  getMentees: () =>
    apiRequest('/api/messaging/mentees'),

  removeMentee: (menteeId) =>
    apiRequest(`/api/messaging/mentees/${menteeId}`, { method: 'DELETE' }),

  editMessage: (messageId, content) =>
    apiRequest(`/api/messaging/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  deleteMessage: (messageId) =>
    apiRequest(`/api/messaging/${messageId}`, { method: 'DELETE' }),
};

// ============ Profile API ============

export const profileApi = {
  getProfile: (username) =>
    apiRequest(`/api/profile/${username}`),
  
  updateProfile: (userId, data) =>
    apiRequest(`/api/profile/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  getGitHubStats: (username, refresh = false) =>
    apiRequest(`/api/profile/${username}/github-stats?refresh=${refresh}`),
  
  getUserRepos: (username) =>
    apiRequest(`/api/profile/${username}/repos`),
  
  connectRepo: (userId, repoName, enableMonitoring = true) =>
    apiRequest(`/api/profile/${userId}/connect-repo`, {
      method: 'POST',
      body: JSON.stringify({ repo_name: repoName, enable_monitoring: enableMonitoring }),
    }),
  
  disconnectRepo: (userId, repoName) =>
    apiRequest(`/api/profile/${userId}/disconnect-repo?repo_name=${repoName}`, {
      method: 'DELETE',
    }),
  
  getConnectedRepos: (userId) =>
    apiRequest(`/api/profile/${userId}/connected-repos`),
  
  getFeaturedBadges: (username) =>
    apiRequest(`/api/profile/${username}/featured-badges`),
  
  updateFeaturedBadges: (username, badgeIds) =>
    apiRequest(`/api/profile/${username}/featured-badges`, {
      method: 'PUT',
      body: JSON.stringify({ badge_ids: badgeIds }),
    }),
};

// ============ Repository API ============

export const repositoryApi = {
  getAllRepositories: () =>
    apiRequest('/api/repositories'),
  
  getMaintainerRepos: () =>
    apiRequest('/api/repositories/maintainer'),
  
  getContributorRepos: () =>
    apiRequest('/api/repositories/contributor'),
  
  addRepository: (repoFullName) =>
    apiRequest('/api/repositories', {
      method: 'POST',
      body: JSON.stringify({ repoFullName }),
    }),
};

export default {
  mentorApi,
  trophyApi,
  ragApi,
  chatApi,
  communityApi,
  gamificationApi,
  analyticsApi,
  sentimentApi,
  cookieLickingApi,
  claimApi,
  profileApi,
  repositoryApi,
  messagingApi,
};

