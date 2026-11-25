/**
 * Client for the coordination APIs + query keys for the SWR cache (lib/query.js).
 * Auth header is set globally on axios by the auth store.
 */
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"}/api`;

export const API_BASE = API;

function errorMessage(err) {
  return err?.response?.data?.error || err?.message || "Request failed";
}

async function get(path, params) {
  try {
    const res = await axios.get(`${API}${path}`, { params });
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err));
  }
}

async function send(method, path, body, params) {
  try {
    const res = await axios({ method, url: `${API}${path}`, data: body, params });
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err));
  }
}

const enc = encodeURIComponent;
const fresh = (o) => (o?.fresh ? { fresh: 1 } : {});
const ref = (owner, repo, number) => `${enc(owner)}/${enc(repo)}/${enc(number)}`;

export const workApi = {
  nextActions: (workspace, o) => get("/next-actions", { workspace, ...fresh(o) }),
  findWork: (filters, o) => get("/work/find", { ...filters, ...fresh(o) }),
  issue: (owner, repo, number, o) => get(`/work/issue/${ref(owner, repo, number)}`, fresh(o)),
  contextPack: (owner, repo, number, ai = false) =>
    get(`/work/issue/${ref(owner, repo, number)}/context`, ai ? { ai: 1 } : undefined),
  pr: (owner, repo, number, o) => get(`/work/pr/${ref(owner, repo, number)}`, fresh(o)),
  prs: (scope, o) => get("/work/prs", { scope, ...fresh(o) }),
  inbox: (o) => get("/work/inbox", fresh(o)),
  repoLens: (owner, repo) => get(`/repo-lens/${enc(owner)}/${enc(repo)}`),
  trackedRepos: () => get("/work/repos"),
  untrackRepo: (full) => send("delete", "/work/repos", undefined, { repo: full }),
  addRepo: (owner, repo) => send("post", "/sync/add-repo", { owner, repo }),
  comment: (owner, repo, number, body) => send("post", `/work/item/${ref(owner, repo, number)}`, { action: "comment", body }),
  addLabels: (owner, repo, number, labels) => send("post", `/work/item/${ref(owner, repo, number)}`, { action: "label", labels }),
  thread: (owner, repo, number, o) => get(`/work/item/${ref(owner, repo, number)}/thread`, fresh(o)),
  history: (owner, repo, number) => get(`/work/item/${ref(owner, repo, number)}/history`),
  signals: () => get("/me/signals"),
  contributor: (owner, repo, login, o) => get(`/work/contributor/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(login)}`, fresh(o)),
  opportunities: (params, o) => get("/work/opportunities", { ...params, ...fresh(o) }),
  savedReplies: () => get("/maintainer/templates"),
  saveReply: (name, body) => send("post", "/maintainer/templates", { name, body }),
  deleteReply: (id) => send("delete", "/maintainer/templates", undefined, { id }),
  journey: (o) => get("/journey", fresh(o)),
  programs: (params) => get("/programs", params),
  myPrograms: () => get("/me/programs"),
  addMyProgram: (body) => send("post", "/me/programs", body),
  updateMyProgram: (id, body) => send("patch", `/me/programs/${encodeURIComponent(id)}`, body),
  removeMyProgram: (id) => send("delete", `/me/programs/${encodeURIComponent(id)}`),
  profileSettings: () => get("/profile/settings"),
  saveProfileSettings: (settings) => send("put", "/profile/settings", settings),
  publicProfile: (login) => get(`/u/${encodeURIComponent(login)}`),
  removeLabels: (owner, repo, number, labels) => send("post", `/work/item/${ref(owner, repo, number)}`, { action: "unlabel", labels }),
  community: (o) => get("/maintainer/community", fresh(o)),
  docsHealth: (repo, o) => get("/maintainer/docs-health", { repo, ...fresh(o) }),
  createDoc: (repo, item) => send("post", "/maintainer/docs-health/create", { repo, item }),
  /** Repos you can maintain on GitHub, your orgs, and whether sign-in needs re-connecting. */
  access: (o) => get("/me/access", { ...fresh(o), ...(o?.autotrack ? { autotrack: 1 } : {}) }),
  trackRepos: (repos) => send("post", "/me/access", { repos }),
  /** What you're looking for (goals) and your save / hide / not-for-me feedback. */
  goals: () => get("/me/goals"),
  saveGoals: (goals) => send("put", "/me/goals", { goals }),
  feedback: (id, action, tags) => send("post", "/me/goals", { id, action, tags }),
  /** Repo context without AI: map, skills, score, starter AGENTS.md; Change card and test run for a PR. */
  repoContext: (owner, repo, o) => get(`/context/${enc(owner)}/${enc(repo)}`, fresh(o)),
  changeCard: (repo, number) => get("/context/change-card", { repo, number }),
  runTests: (repo, number) => send("post", "/context/change-card", { repo, number }),
  /** Maintainer hub: per-repo to-do, and funding/programs with eligibility per repo. */
  repoTodo: (repo, o) => get("/maintainer/todo", { repo, ...fresh(o) }),
  funding: () => get("/maintainer/funding"),
  /** Projects directory and opportunities ranked for you, with reasons. */
  recRepos: (params) => get("/me/recommendations/repos", params),
  recOpportunities: () => get("/me/recommendations/opportunities"),
};

/** Cache keys: one place so pages, panel and prefetch agree. */
export const keys = {
  today: (ws) => `today:${ws}`,
  find: (filters) => `find:${JSON.stringify(filters)}`,
  issue: (o, r, n) => `issue:${o}/${r}#${n}`.toLowerCase(),
  context: (o, r, n) => `ctx:${o}/${r}#${n}`.toLowerCase(),
  pr: (o, r, n) => `pr:${o}/${r}#${n}`.toLowerCase(),
  prs: (scope) => `prs:${scope}`,
  inbox: () => "inbox",
  lens: (o, r) => `lens:${o}/${r}`.toLowerCase(),
  repos: () => "repos",
  replies: () => "replies",
  thread: (o, r, n) => `thread:${o}/${r}#${n}`.toLowerCase(),
  history: (o, r, n) => `history:${o}/${r}#${n}`.toLowerCase(),
  signals: () => "signals",
  contributor: (o, r, login) => `contrib:${o}/${r}:${login}`.toLowerCase(),
  opportunities: (params) => `opp:${JSON.stringify(params)}`,
  journey: () => "journey",
  programs: () => "programs",
  myPrograms: () => "me:programs",
  community: () => "community",
  docs: (repo) => `docs:${repo}`.toLowerCase(),
  // Tied to the sign-in, so a fresh sign-in never shows the previous answer.
  access: () => `access:${(localStorage.getItem("token") || "").slice(-16)}`,
  goals: () => "goals",
  todo: (repo) => `todo:${repo}`.toLowerCase(),
  context: (o, r) => `context:${o}/${r}`.toLowerCase(),
  funding: () => "funding",
  recRepos: (params) => `rec:repos:${JSON.stringify(params)}`,
  recOpportunities: () => "rec:opps",
};

/**
 * Parse "owner/repo", "owner/repo#12", or a github.com issue/PR/repo URL.
 * Returns { owner, repo, number?, kind? } or null.
 */
export function parseGitHubRef(input) {
  const s = (input || "").trim();
  const url = s.match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(issues|pull)\/(\d+))?/i);
  if (url) {
    return {
      owner: url[1],
      repo: url[2].replace(/\.git$/, ""),
      number: url[4] ? Number(url[4]) : undefined,
      kind: url[3] === "pull" ? "pr" : url[3] ? "issue" : undefined,
    };
  }
  const short = s.match(/^([\w.-]+)\/([\w.-]+?)(?:#(\d+))?$/);
  if (short) return { owner: short[1], repo: short[2], number: short[3] ? Number(short[3]) : undefined };
  return null;
}
