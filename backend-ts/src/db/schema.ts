import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// =============================================================================
// ENUMS (stored as TEXT with application-level validation)
// =============================================================================

export const userRoleEnum = ["MAINTAINER", "CONTRIBUTOR"] as const;
export const classificationEnum = [
    "CRITICAL_BUG", "BUG", "FEATURE_REQUEST", "QUESTION",
    "DOCS", "DUPLICATE", "NEEDS_INFO", "SPAM"
] as const;
export const sentimentEnum = ["POSITIVE", "NEUTRAL", "NEGATIVE", "FRUSTRATED"] as const;
export const profileVisibilityEnum = ["public", "private", "connections_only"] as const;
export const expertiseLevelEnum = ["beginner", "intermediate", "advanced", "expert"] as const;
export const sessionTypeEnum = ["one_on_one", "group", "issue_help"] as const;
export const sessionStatusEnum = ["active", "paused", "completed", "cancelled"] as const;
export const resourceTypeEnum = [
    "link", "code_snippet", "documentation", "tutorial", "tool", "example", "answer"
] as const;
export const trophyTypeEnum = [
    "first_pr", "pr_master", "pr_legend", "bug_hunter", "bug_slayer",
    "first_mentor", "master_mentor", "streak_starter", "streak_warrior", "streak_legend",
    "triage_helper", "triage_hero", "first_review", "review_guru",
    "welcome_committee", "documentation_hero", "early_adopter", "top_contributor"
] as const;
export const trophyRarityEnum = ["common", "uncommon", "rare", "legendary"] as const;

// =============================================================================
// CORE TABLES
// =============================================================================

// ---- Users ----
export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    githubId: integer("github_id").unique().notNull(),
    username: text("username").notNull(),
    avatarUrl: text("avatar_url").notNull(),
    role: text("role"),  // UserRole enum
    githubAccessToken: text("github_access_token"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
});

// ---- Repositories ----
export const repositories = sqliteTable("repositories", {
    id: text("id").primaryKey(),
    githubRepoId: integer("github_repo_id").notNull(),
    name: text("name").notNull(),
    owner: text("owner").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    etag: text("etag"),  // GitHub ETag for conditional requests
    lastSyncedAt: text("last_synced_at"),  // When the repo was last synced
    createdAt: text("created_at").notNull(),
});

// ---- Issues ----
export const issues = sqliteTable("issues", {
    id: text("id").primaryKey(),
    githubIssueId: integer("github_issue_id").notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    authorName: text("author_name").notNull(),
    repoId: text("repo_id").notNull().references(() => repositories.id),
    repoName: text("repo_name").notNull(),
    owner: text("owner"),
    repo: text("repo"),
    htmlUrl: text("html_url"),
    state: text("state").notNull().default("open"),
    isPR: integer("is_pr", { mode: "boolean" }).notNull().default(false),
    authorAssociation: text("author_association"),  // OWNER, MEMBER, COLLABORATOR, etc.
    createdAt: text("created_at").notNull(),
});

// ---- Triage Data ----
export const triageData = sqliteTable("triage_data", {
    id: text("id").primaryKey(),
    issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    classification: text("classification").notNull(),  // Classification enum
    summary: text("summary").notNull(),
    suggestedLabel: text("suggested_label").notNull(),
    sentiment: text("sentiment").notNull(),  // Sentiment enum
    analyzedAt: text("analyzed_at").notNull(),
});

// ---- Templates ----
export const templates = sqliteTable("templates", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    body: text("body").notNull(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    triggerClassification: text("trigger_classification"),
    createdAt: text("created_at").notNull(),
});

// =============================================================================
// PROFILE & MENTORSHIP TABLES
// =============================================================================

// ---- User Profiles ----
export const profiles = sqliteTable("profiles", {
    userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    location: text("location"),
    website: text("website"),
    twitter: text("twitter"),
    availableForMentoring: integer("available_for_mentoring", { mode: "boolean" }).default(false),
    profileVisibility: text("profile_visibility").default("public"),
    showEmail: integer("show_email", { mode: "boolean" }).default(false),
    githubStats: text("github_stats"),  // JSON string
    statsUpdatedAt: text("stats_updated_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
});

// ---- Mentor Profiles ----
export const mentors = sqliteTable("mentors", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    expertiseLevel: text("expertise_level").default("intermediate"),
    availabilityHoursPerWeek: integer("availability_hours_per_week").default(5),
    timezone: text("timezone"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    menteeCount: integer("mentee_count").default(0),
    sessionsCompleted: integer("sessions_completed").default(0),
    avgRating: real("avg_rating").default(0.0),
    totalRatings: integer("total_ratings").default(0),
    maxMentees: integer("max_mentees").default(3),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
});

// ---- Mentor Matches ----
export const mentorMatches = sqliteTable("mentor_matches", {
    id: text("id").primaryKey(),
    mentorId: text("mentor_id").notNull().references(() => mentors.id, { onDelete: "cascade" }),
    mentorUsername: text("mentor_username").notNull(),
    menteeId: text("mentee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    menteeUsername: text("mentee_username").notNull(),
    compatibilityScore: real("compatibility_score").notNull(),
    matchReason: text("match_reason"),
    issueId: text("issue_id"),
    repoName: text("repo_name"),
    status: text("status").default("suggested"),  // suggested, accepted, declined, completed
    createdAt: text("created_at").notNull(),
});

// ---- Mentorship Requests ----
export const mentorshipRequests = sqliteTable("mentorship_requests", {
    id: text("id").primaryKey(),
    menteeId: text("mentee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    menteeUsername: text("mentee_username"),
    mentorId: text("mentor_id").notNull().references(() => mentors.id, { onDelete: "cascade" }),
    mentorUsername: text("mentor_username"),
    issueId: text("issue_id"),
    message: text("message"),
    status: text("status").default("pending"),  // pending, accepted, declined
    createdAt: text("created_at").notNull(),
});

// ---- Mentor Ratings ----
export const mentorRatings = sqliteTable("mentor_ratings", {
    id: text("id").primaryKey(),
    mentorId: text("mentor_id").notNull().references(() => mentors.id, { onDelete: "cascade" }),
    menteeId: text("mentee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    rating: integer("rating").notNull(),  // 1-5
    feedback: text("feedback"),
    createdAt: text("created_at").notNull(),
});

// =============================================================================
// CHAT & MESSAGING TABLES
// =============================================================================

// ---- Chat Sessions ----
export const chatSessions = sqliteTable("chat_sessions", {
    id: text("id").primaryKey(),
    mentorId: text("mentor_id").notNull().references(() => users.id),
    mentorUsername: text("mentor_username").notNull(),
    sessionType: text("session_type").default("one_on_one"),
    issueId: text("issue_id"),
    repoName: text("repo_name"),
    topic: text("topic"),
    status: text("status").default("active"),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    lastActivityAt: text("last_activity_at").notNull(),
    summary: text("summary"),
    messageCount: integer("message_count").default(0),
    durationMinutes: integer("duration_minutes").default(0),
});

// ---- Chat Messages ----
export const chatMessages = sqliteTable("chat_messages", {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull().references(() => users.id),
    senderUsername: text("sender_username").notNull(),
    isMentor: integer("is_mentor", { mode: "boolean" }).default(false),
    content: text("content").notNull(),
    messageType: text("message_type").default("text"),  // text, code, link, file
    language: text("language"),  // for code blocks
    isAiGenerated: integer("is_ai_generated", { mode: "boolean" }).default(false),
    containsResource: integer("contains_resource", { mode: "boolean" }).default(false),
    extractedResourceId: text("extracted_resource_id"),
    timestamp: text("timestamp").notNull(),
    editedAt: text("edited_at"),
});

// ---- Chat History (DEPRECATED - AI chat uses ephemeral history from frontend) ----
// This table stored AI chat history but was never read. Kept for reference.
// To be removed in a future migration after verifying no data loss impact.
// export const chatHistory = sqliteTable("chat_history", {
//     id: text("id").primaryKey(),
//     userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
//     sessionId: text("session_id").notNull(),
//     createdAt: text("created_at").notNull(),
// });

// ---- Issue Chats ----
export const issueChats = sqliteTable("issue_chats", {
    id: text("id").primaryKey(),
    issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
});

// ---- Direct Messages ----
export const messages = sqliteTable("messages", {
    id: text("id").primaryKey(),
    senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    read: integer("read", { mode: "boolean" }).default(false),
    timestamp: text("timestamp").notNull(),
    editedAt: text("edited_at"),
});

// ---- Global Chat Messages (Ably persistence) ----
export const globalChatMessages = sqliteTable("global_chat_messages", {
    id: text("id").primaryKey(),
    senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senderUsername: text("sender_username").notNull(),
    senderAvatarUrl: text("sender_avatar_url"),
    content: text("content").notNull(),
    timestamp: text("timestamp").notNull(),
});

// =============================================================================
// GAMIFICATION TABLES
// =============================================================================

// ---- Trophies ----
export const trophies = sqliteTable("trophies", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    trophyType: text("trophy_type").notNull(),  // TrophyType enum
    name: text("name").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    rarity: text("rarity").notNull(),  // common, uncommon, rare, legendary
    svgData: text("svg_data"),
    isPublic: integer("is_public", { mode: "boolean" }).default(true),
    shareUrl: text("share_url"),
    earnedFor: text("earned_for"),  // e.g., "owner/repo"
    milestoneValue: integer("milestone_value"),
    awardedAt: text("awarded_at").notNull(),
});

// ---- Resources ----
export const resources = sqliteTable("resources", {
    id: text("id").primaryKey(),
    repoName: text("repo_name").notNull(),
    sourceType: text("source_type").default("chat"),
    sourceId: text("source_id"),
    resourceType: text("resource_type").notNull(),  // ResourceType enum
    title: text("title").notNull(),
    content: text("content").notNull(),
    description: text("description"),
    language: text("language"),
    sharedBy: text("shared_by").notNull(),
    sharedById: text("shared_by_id").notNull().references(() => users.id),
    saveCount: integer("save_count").default(0),
    helpfulCount: integer("helpful_count").default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
});

// ---- User Saved Resources ----
export const userSavedResources = sqliteTable("user_saved_resources", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    resourceId: text("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
    notes: text("notes"),
    savedAt: text("saved_at").notNull(),
});

// =============================================================================
// JUNCTION TABLES (Normalized Arrays)
// =============================================================================

// ---- User Repositories (User.repositories array) ----
export const userRepositories = sqliteTable("user_repositories", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    repoFullName: text("repo_full_name").notNull(),
    addedAt: text("added_at").notNull(),
}, (table) => ({
    // Unique constraint on userId + repoFullName to prevent duplicate tracking
    userRepoUnique: uniqueIndex("user_repo_unique").on(table.userId, table.repoFullName),
}));

// ---- Profile Skills ----
export const profileSkills = sqliteTable("profile_skills", {
    profileId: text("profile_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    skill: text("skill").notNull(),
});

// ---- Profile Mentoring Topics ----
export const profileMentoringTopics = sqliteTable("profile_mentoring_topics", {
    profileId: text("profile_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
});

// ---- Profile Connected Repos ----
export const profileConnectedRepos = sqliteTable("profile_connected_repos", {
    profileId: text("profile_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    repoName: text("repo_name").notNull(),
});

// ---- Mentor Tech Stack ----
export const mentorTechStack = sqliteTable("mentor_tech_stack", {
    mentorId: text("mentor_id").notNull().references(() => mentors.id, { onDelete: "cascade" }),
    tech: text("tech").notNull(),
});

// ---- Mentor Languages ----
export const mentorLanguages = sqliteTable("mentor_languages", {
    mentorId: text("mentor_id").notNull().references(() => mentors.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
});

// ---- Mentor Frameworks ----
export const mentorFrameworks = sqliteTable("mentor_frameworks", {
    mentorId: text("mentor_id").notNull().references(() => mentors.id, { onDelete: "cascade" }),
    framework: text("framework").notNull(),
});

// ---- Mentor Preferred Topics ----
export const mentorPreferredTopics = sqliteTable("mentor_preferred_topics", {
    mentorId: text("mentor_id").notNull().references(() => mentors.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
});

// ---- Mentor Match Matched Skills ----
export const mentorMatchSkills = sqliteTable("mentor_match_skills", {
    matchId: text("match_id").notNull().references(() => mentorMatches.id, { onDelete: "cascade" }),
    skill: text("skill").notNull(),
});

// ---- Chat Session Mentees ----
export const chatSessionMentees = sqliteTable("chat_session_mentees", {
    sessionId: text("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
    menteeId: text("mentee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    menteeUsername: text("mentee_username").notNull(),
});

// ---- Chat Session Key Points ----
export const chatSessionKeyPoints = sqliteTable("chat_session_key_points", {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
    keyPoint: text("key_point").notNull(),
    sortOrder: integer("sort_order").default(0),
});

// ---- Chat Session Resources Shared ----
export const chatSessionResources = sqliteTable("chat_session_resources", {
    sessionId: text("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
    resourceId: text("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
});

// ---- Chat History Messages (DEPRECATED - see chatHistory above) ----
// export const chatHistoryMessages = sqliteTable("chat_history_messages", {
//     id: text("id").primaryKey(),
//     chatHistoryId: text("chat_history_id").notNull().references(() => chatHistory.id, { onDelete: "cascade" }),
//     role: text("role").notNull(),  // 'user' | 'assistant'
//     content: text("content").notNull(),
//     timestamp: text("timestamp").notNull(),
//     githubCommentId: text("github_comment_id"),
//     githubCommentUrl: text("github_comment_url"),
// });

// ---- Issue Chat Messages ----
export const issueChatMessages = sqliteTable("issue_chat_messages", {
    id: text("id").primaryKey(),
    issueChatId: text("issue_chat_id").notNull().references(() => issueChats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    timestamp: text("timestamp").notNull(),
    githubCommentId: text("github_comment_id"),
    githubCommentUrl: text("github_comment_url"),
});

// ---- Chat Message Attachments ----
export const chatMessageAttachments = sqliteTable("chat_message_attachments", {
    messageId: text("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
    attachment: text("attachment").notNull(),
});

// ---- Chat Message Reactions ----
export const chatMessageReactions = sqliteTable("chat_message_reactions", {
    messageId: text("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

// ---- Resource Tags ----
export const resourceTags = sqliteTable("resource_tags", {
    resourceId: text("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
});

// =============================================================================
// RELATIONS (for Drizzle Query API)
// =============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
    repositories: many(repositories),
    issues: many(issues),
    profile: one(profiles),
    trophies: many(trophies),
    sentMessages: many(messages, { relationName: "sender" }),
    receivedMessages: many(messages, { relationName: "receiver" }),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
    user: one(users, { fields: [repositories.userId], references: [users.id] }),
    issues: many(issues),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
    repository: one(repositories, { fields: [issues.repoId], references: [repositories.id] }),
    triageData: one(triageData),
    issueChats: many(issueChats),
}));

export const triageDataRelations = relations(triageData, ({ one }) => ({
    issue: one(issues, { fields: [triageData.issueId], references: [issues.id] }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
    user: one(users, { fields: [profiles.userId], references: [users.id] }),
    skills: many(profileSkills),
    mentoringTopics: many(profileMentoringTopics),
    connectedRepos: many(profileConnectedRepos),
}));

export const mentorsRelations = relations(mentors, ({ one, many }) => ({
    user: one(users, { fields: [mentors.userId], references: [users.id] }),
    matches: many(mentorMatches),
    requests: many(mentorshipRequests),
    ratings: many(mentorRatings),
    techStack: many(mentorTechStack),
    languages: many(mentorLanguages),
    frameworks: many(mentorFrameworks),
    preferredTopics: many(mentorPreferredTopics),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
    mentor: one(users, { fields: [chatSessions.mentorId], references: [users.id] }),
    messages: many(chatMessages),
    mentees: many(chatSessionMentees),
    keyPoints: many(chatSessionKeyPoints),
    sharedResources: many(chatSessionResources),
}));

export const trophiesRelations = relations(trophies, ({ one }) => ({
    user: one(users, { fields: [trophies.userId], references: [users.id] }),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
    sharer: one(users, { fields: [resources.sharedById], references: [users.id] }),
    tags: many(resourceTags),
    savedBy: many(userSavedResources),
}));
