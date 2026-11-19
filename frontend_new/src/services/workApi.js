/**
 * Client for the coordination APIs (discovery, understanding, next actions).
 * Auth header is set globally on axios by the auth store.
 */
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"}/api`;

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

async function post(path, body) {
  try {
    const res = await axios.post(`${API}${path}`, body);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err));
  }
}

const enc = encodeURIComponent;

export const workApi = {
  nextActions: (workspace, repos) =>
    get("/next-actions", { workspace, ...(repos?.length ? { repos: repos.join(",") } : {}) }),
  findWork: (filters) => get("/work/find", filters),
  issue: (owner, repo, number) => get(`/work/issue/${enc(owner)}/${enc(repo)}/${enc(number)}`),
  contextPack: (owner, repo, number, ai = false) =>
    get(`/work/issue/${enc(owner)}/${enc(repo)}/${enc(number)}/context`, ai ? { ai: 1 } : undefined),
  repoLens: (owner, repo) => get(`/repo-lens/${enc(owner)}/${enc(repo)}`),
  addRepo: (owner, repo) => post("/sync/add-repo", { owner, repo }),
};

/**
 * Parse "owner/repo", "owner/repo#12", or a github.com issue/PR/repo URL.
 * Returns { owner, repo, number? } or null.
 */
export function parseGitHubRef(input) {
  const s = (input || "").trim();
  const url = s.match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:issues|pull)\/(\d+))?/i);
  if (url) return { owner: url[1], repo: url[2].replace(/\.git$/, ""), number: url[3] ? Number(url[3]) : undefined };
  const short = s.match(/^([\w.-]+)\/([\w.-]+?)(?:#(\d+))?$/);
  if (short) return { owner: short[1], repo: short[2], number: short[3] ? Number(short[3]) : undefined };
  return null;
}
