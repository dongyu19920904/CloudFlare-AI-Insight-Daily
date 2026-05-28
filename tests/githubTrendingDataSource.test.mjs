import test from "node:test";
import assert from "node:assert/strict";

import { parseGithubTrendingHtml } from "../src/dataSources/github-trending.js";

test("parseGithubTrendingHtml extracts GitHub daily trending repositories", () => {
  const html = `
    <article class="Box-row">
      <h2 class="h3 lh-condensed">
        <a href="/harry0703/MoneyPrinterTurbo">
          <span class="text-normal">harry0703 /</span>
          MoneyPrinterTurbo
        </a>
      </h2>
      <p class="col-9 color-fg-muted my-1">
        利用AI大模型，一键生成高清短视频 Generate short videos with one click using AI LLM.
      </p>
      <span itemprop="programmingLanguage">Python</span>
      <a href="/harry0703/MoneyPrinterTurbo/stargazers">1,234</a>
      <a href="/harry0703/MoneyPrinterTurbo/forks">56</a>
      <span class="d-inline-block float-sm-right">77 stars today</span>
    </article>
  `;

  const projects = parseGithubTrendingHtml(html);

  assert.equal(projects.length, 1);
  assert.equal(projects[0].owner, "harry0703");
  assert.equal(projects[0].name, "MoneyPrinterTurbo");
  assert.equal(projects[0].url, "https://github.com/harry0703/MoneyPrinterTurbo");
  assert.match(projects[0].description, /AI大模型/);
  assert.equal(projects[0].language, "Python");
  assert.equal(projects[0].starsToday, 77);
  assert.equal(projects[0].source, "GitHub Trending Daily");
  assert.equal(projects[0].sourceKind, "trending-daily");
});
