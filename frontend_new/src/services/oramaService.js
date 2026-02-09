/**
 * Lightweight Full-Text Search Service
 *
 * In-memory search engine for README content.
 * Provides TF-IDF-like scoring with title boosting, bigram matching, and
 * repository filtering — no external dependencies required.
 */

// ── Tokenizer helpers ──────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "is",
  "it",
  "this",
  "that",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "shall",
  "not",
  "no",
  "so",
  "if",
  "about",
  "up",
  "out",
  "from",
  "as",
  "into",
  "its",
  "my",
  "me",
  "i",
  "you",
  "your",
  "we",
  "our",
  "he",
  "she",
  "they",
  "them",
  "what",
  "which",
  "who",
  "how",
  "when",
  "where",
  "why",
]);

/**
 * Very simple suffix-stripping stemmer.
 * Handles the most common English suffixes so "installation" → "instal",
 * "running" → "run", "projects" → "project", etc.
 */
function stem(word) {
  return word
    .replace(/ies$/, "y")
    .replace(/tion$/, "t")
    .replace(/sion$/, "s")
    .replace(/ment$/, "")
    .replace(/ness$/, "")
    .replace(/able$/, "")
    .replace(/ible$/, "")
    .replace(/ful$/, "")
    .replace(/ing$/, "")
    .replace(/ous$/, "")
    .replace(/ive$/, "")
    .replace(/ly$/, "")
    .replace(/ed$/, "")
    .replace(/er$/, "")
    .replace(/es$/, "")
    .replace(/s$/, "");
}

/**
 * Tokenize text into lowercase words, removing punctuation & stop words.
 * Returns both raw and stemmed forms for broader matching.
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Produce stemmed token set (de-duplicated) for matching.
 */
function stemTokens(tokens) {
  return [...new Set(tokens.map(stem).filter((s) => s.length > 1))];
}

/**
 * Generate bigrams from a token array for phrase matching.
 */
function bigrams(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

// ── Index class ────────────────────────────────────────────────────

class SearchIndex {
  constructor() {
    /** @type {Array<{id: string, title: string, content: string, repository: string, section: string, sourceUrl: string, level: number, tokens: string[], titleTokens: string[]}>} */
    this.documents = [];
    /** @type {Map<string, Set<number>>} token → set of doc indices */
    this.invertedIndex = new Map();
    this._nextId = 0;
  }

  /**
   * Add a document to the index.
   */
  insert(doc) {
    const id = `doc-${this._nextId++}`;
    const tokens = tokenize(doc.content);
    const titleTokens = tokenize(doc.title);
    const stemmedTokens = stemTokens([...tokens, ...titleTokens]);
    const allTokens = [...tokens, ...titleTokens, ...stemmedTokens];

    const entry = { ...doc, id, tokens, titleTokens, stemmedTokens };
    const idx = this.documents.length;
    this.documents.push(entry);

    // Build inverted index (raw + stemmed forms)
    const seen = new Set();
    for (const t of allTokens) {
      if (!seen.has(t)) {
        seen.add(t);
        if (!this.invertedIndex.has(t)) {
          this.invertedIndex.set(t, new Set());
        }
        this.invertedIndex.get(t).add(idx);
      }
    }

    return id;
  }

  /**
   * Search documents with TF-IDF-like relevance scoring.
   */
  search(query, limit = 10, repository = null) {
    const queryTokens = tokenize(query);
    const queryStemmed = stemTokens(queryTokens);
    // Merge raw + stemmed query terms for broader recall
    const allQueryTerms = [...new Set([...queryTokens, ...queryStemmed])];

    const queryBigrams = bigrams(queryTokens);
    const N = this.documents.length;
    if (N === 0) return [];

    // If ALL query tokens were stop-words, go straight to fallback
    if (allQueryTerms.length === 0) {
      return this._fallbackByRepo(repository, limit);
    }
    const candidates = new Set();
    for (const qt of allQueryTerms) {
      // Exact, prefix, and reverse-prefix matching
      for (const [term, docSet] of this.invertedIndex) {
        if (term === qt || term.startsWith(qt) || qt.startsWith(term)) {
          for (const di of docSet) candidates.add(di);
        }
      }
    }

    // Score each candidate
    const scored = [];
    for (const di of candidates) {
      const doc = this.documents[di];

      // Optional repo filter
      if (repository && doc.repository !== repository) continue;

      let score = 0;

      // ── Token frequency in content (raw + stemmed) ──
      for (const qt of allQueryTerms) {
        const tf = doc.tokens.filter(
          (t) => t === qt || t.startsWith(qt),
        ).length;
        // Also count stemmed matches
        const stf = (doc.stemmedTokens || []).filter(
          (t) => t === qt || t.startsWith(qt),
        ).length;
        const totalTf = tf + stf * 0.5; // stemmed matches worth half
        if (totalTf > 0) {
          const df = this.invertedIndex.get(qt)?.size || 1;
          const idf = Math.log(1 + N / df);
          score += totalTf * idf;
        }
      }

      // ── Title boost (3×) ──
      for (const qt of allQueryTerms) {
        if (doc.titleTokens.some((t) => t === qt || t.startsWith(qt))) {
          score += 3;
        }
      }

      // ── Bigram bonus (phrase proximity) ──
      const contentLower = doc.content.toLowerCase();
      for (const bg of queryBigrams) {
        if (contentLower.includes(bg)) {
          score += 2;
        }
      }

      // ── Exact substring match bonus ──
      const queryLower = query.toLowerCase();
      if (contentLower.includes(queryLower)) {
        score += 5;
      }
      if (doc.title.toLowerCase().includes(queryLower)) {
        score += 8;
      }

      if (score > 0) {
        scored.push({
          title: doc.title,
          content: doc.content,
          section: doc.title,
          repository: doc.repository,
          sourceUrl: doc.sourceUrl,
          level: doc.level,
          score,
        });
      }
    }

    // Sort by score descending, return top N
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit);

    // ── Fallback: if strict matching found nothing, return all sections ──
    // Handles generic/overview queries like "explain this project",
    // "what is this", "tell me about it" where tokens don't match verbatim.
    if (results.length === 0) {
      return this._fallbackByRepo(repository, limit);
    }

    return results;
  }

  /**
   * Fallback: return all sections for a repository, ordered by position.
   * Used when the query is too generic to match specific tokens.
   */
  _fallbackByRepo(repository, limit) {
    const docs = repository
      ? this.documents.filter((d) => d.repository === repository)
      : this.documents;

    return docs
      .map((d, i) => ({
        title: d.title,
        content: d.content,
        section: d.title,
        repository: d.repository,
        sourceUrl: d.sourceUrl,
        level: d.level,
        score: 1 / (i + 1),
      }))
      .slice(0, limit);
  }

  /** Return the total number of indexed documents. */
  get docCount() {
    return this.documents.length;
  }

  /** Clear all documents for a given repository. */
  removeByRepo(repository) {
    // Rebuild everything without that repo
    const kept = this.documents.filter((d) => d.repository !== repository);
    this.documents = [];
    this.invertedIndex.clear();
    this._nextId = 0;
    for (const doc of kept) {
      this.insert(doc);
    }
  }

  /** Clear the entire index. */
  clear() {
    this.documents = [];
    this.invertedIndex.clear();
    this._nextId = 0;
  }
}

// ── Public API (same signatures the hook expects) ──────────────────

/**
 * Create a new search index.
 */
export async function createReadmeIndex() {
  return new SearchIndex();
}

/**
 * Index README sections.
 * @param {SearchIndex} index
 * @param {string} owner
 * @param {string} repo
 * @param {Array<{title: string, content: string, level: number}>} sections
 * @param {string} sourceUrl
 * @returns {Promise<string[]>} inserted document IDs
 */
export async function indexReadmeSections(
  index,
  owner,
  repo,
  sections,
  sourceUrl,
) {
  const repository = `${owner}/${repo}`;

  // Remove any previous docs for this repo so re-indexing doesn't duplicate
  index.removeByRepo(repository);

  const ids = sections.map((sec) =>
    index.insert({
      title: sec.title,
      content: sec.content,
      repository,
      section: sec.title,
      sourceUrl,
      level: sec.level,
    }),
  );

  console.log(
    `📝 Indexed ${ids.length} sections for ${repository} (total docs: ${index.docCount})`,
  );
  return ids;
}

/**
 * Search README content.
 * @param {SearchIndex} index
 * @param {string} query
 * @param {number} limit
 * @param {string|null} repository
 */
export async function searchReadme(
  index,
  query,
  limit = 10,
  repository = null,
) {
  return index.search(query, limit, repository);
}

/**
 * Get list of indexed repositories.
 * @param {SearchIndex} index
 */
export async function getIndexedRepositories(index) {
  return [...new Set(index.documents.map((d) => d.repository))];
}

/**
 * Get index statistics.
 * @param {SearchIndex} index
 */
export async function getIndexStats(index) {
  return { docCount: index.docCount };
}
