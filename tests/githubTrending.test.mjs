import test from "node:test";
import assert from "node:assert/strict";

import { parseGithubTrendingHtml } from "../src/dataSources/github-trending.js";

test("parseGithubTrendingHtml extracts projects from GitHub trending markup", () => {
  const html = `
    <article class="Box-row">
      <h2 class="h3 lh-condensed">
        <a href="/acme/agent-kit">
          acme / agent-kit
        </a>
      </h2>
      <p class="col-9 color-fg-muted my-1 pr-4">
        Build &amp; ship AI agents from one repo.
      </p>
      <span itemprop="programmingLanguage">TypeScript</span>
      <a href="/acme/agent-kit/stargazers">1,234</a>
      <a href="/acme/agent-kit/network/members">56</a>
      <span class="d-inline-block float-sm-right">89 stars today</span>
    </article>
  `;

  const [project] = parseGithubTrendingHtml(html);

  assert.equal(project.owner, "acme");
  assert.equal(project.name, "agent-kit");
  assert.equal(project.url, "https://github.com/acme/agent-kit");
  assert.equal(project.description, "Build & ship AI agents from one repo.");
  assert.equal(project.language, "TypeScript");
  assert.equal(project.totalStars, "1234");
  assert.equal(project.forks, "56");
  assert.equal(project.starsToday, "89");
});
