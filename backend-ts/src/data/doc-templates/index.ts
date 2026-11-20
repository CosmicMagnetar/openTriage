/**
 * Starter files that "Docs health → Add" opens as a pull request.
 * Kept short and neutral on purpose: maintainers edit them in the PR.
 * `{{owner}}`, `{{repo}}`, `{{year}}`, `{{branch}}` are filled in by `renderTemplate`.
 */

export interface DocTemplateFile {
    path: string;
    content: string;
}

export interface DocTemplate {
    files: DocTemplateFile[];
    /** One line for the PR title, e.g. "Add a contributing guide". */
    title: string;
    /** Extra notes for the PR body (what to review before merging). */
    notes: string;
}

const README = `# {{repo}}

One or two sentences on what {{repo}} does and who it is for.

## Getting started

\`\`\`bash
git clone https://github.com/{{owner}}/{{repo}}.git
cd {{repo}}
# install and run steps go here
\`\`\`

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.

## License

See [LICENSE](LICENSE).
`;

const CONTRIBUTING = `# Contributing to {{repo}}

Thanks for taking the time to contribute!

## Finding something to work on

- Issues labelled \`good first issue\` are a good place to start.
- Comment on an issue before you start so others know it is taken.
- For larger changes, open an issue to discuss the approach first.

## Making a change

1. Fork the repository and create a branch from \`{{branch}}\`.
2. Set up the project locally (see the README).
3. Make your change, with tests where it makes sense.
4. Run the tests and linter before pushing.
5. Open a pull request that links the issue it fixes (\`Fixes #123\`).

## Pull request reviews

A maintainer will review your pull request. If it has been a week with no reply,
feel free to leave a friendly comment on it.

## Code of conduct

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
`;

const CODE_OF_CONDUCT = `# Code of Conduct

We want {{repo}} to be a welcoming project for everyone, whatever their
background, identity or experience.

## Expected behaviour

- Be kind and patient, especially with newcomers.
- Assume good intent and give constructive feedback.
- Respect differing viewpoints and experiences.

## Unacceptable behaviour

- Harassment, insults, or personal or political attacks.
- Sexualised language or imagery, and unwelcome attention.
- Publishing others' private information without permission.

## Enforcement

Report unacceptable behaviour to the maintainers at **[contact email]**. Reports are
handled confidentially. Maintainers may remove comments, commits or contributions,
or ban contributors who break this code.

This document is adapted in spirit from the
[Contributor Covenant](https://www.contributor-covenant.org/). You may prefer to
replace it with the full Contributor Covenant text.
`;

const LICENSE_MIT = `MIT License

Copyright (c) {{year}} {{owner}}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const SECURITY = `# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report them privately using GitHub's
[private vulnerability reporting](https://github.com/{{owner}}/{{repo}}/security/advisories/new)
or by email to **[security contact]**.

Include what you found, steps to reproduce, and the impact you expect. We aim to
reply within 7 days and will keep you updated until a fix is released.

## Supported versions

Security fixes are made for the latest release on \`{{branch}}\`.
`;

const BUG_REPORT = `---
name: Bug report
about: Something is not working as expected
labels: bug
---

## What happened

## What you expected to happen

## Steps to reproduce

1.
2.

## Environment

- Version:
- OS:
`;

const FEATURE_REQUEST = `---
name: Feature request
about: Suggest an idea or improvement
labels: enhancement
---

## Problem

What are you trying to do, and what gets in the way?

## Proposed solution

## Alternatives considered
`;

const ISSUE_CONFIG = `blank_issues_enabled: true
`;

const PR_TEMPLATE = `## What does this change?

## Related issue

Fixes #

## How was it tested?

## Checklist

- [ ] Tests pass locally
- [ ] Docs updated if needed
`;

const CODEOWNERS = `# Default reviewers for everything in the repository.
# Add more specific paths below, e.g. \`/docs/ @docs-team\`.
* @{{owner}}
`;

export const DOC_TEMPLATES = {
    readme: {
        title: "Add a README",
        notes: "Fill in what the project does and the real install / run steps.",
        files: [{ path: "README.md", content: README }],
    },
    contributing: {
        title: "Add a contributing guide",
        notes: "Check the branch name and test commands match how this project works.",
        files: [{ path: "CONTRIBUTING.md", content: CONTRIBUTING }],
    },
    "code-of-conduct": {
        title: "Add a code of conduct",
        notes: "Replace **[contact email]** with a real address before merging.",
        files: [{ path: "CODE_OF_CONDUCT.md", content: CODE_OF_CONDUCT }],
    },
    license: {
        title: "Add an MIT license",
        notes: "MIT is a starting suggestion. Choosing a license is the project owner's decision — change it before merging if another license fits better (see https://choosealicense.com).",
        files: [{ path: "LICENSE", content: LICENSE_MIT }],
    },
    security: {
        title: "Add a security policy",
        notes: "Replace **[security contact]**, and enable private vulnerability reporting in the repository settings.",
        files: [{ path: "SECURITY.md", content: SECURITY }],
    },
    "issue-templates": {
        title: "Add issue templates",
        notes: "Adds bug report and feature request templates.",
        files: [
            { path: ".github/ISSUE_TEMPLATE/bug_report.md", content: BUG_REPORT },
            { path: ".github/ISSUE_TEMPLATE/feature_request.md", content: FEATURE_REQUEST },
            { path: ".github/ISSUE_TEMPLATE/config.yml", content: ISSUE_CONFIG },
        ],
    },
    "pr-template": {
        title: "Add a pull request template",
        notes: "",
        files: [{ path: ".github/pull_request_template.md", content: PR_TEMPLATE }],
    },
    codeowners: {
        title: "Add CODEOWNERS",
        notes: "Every path defaults to the repository owner; add teams or people for specific areas.",
        files: [{ path: ".github/CODEOWNERS", content: CODEOWNERS }],
    },
} satisfies Record<string, DocTemplate>;

export type TemplateId = keyof typeof DOC_TEMPLATES;
