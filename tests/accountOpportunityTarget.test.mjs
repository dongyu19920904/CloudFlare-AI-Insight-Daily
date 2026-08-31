import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccountOpportunityPaths,
  resolveAccountOpportunityGitHubEnv,
} from "../src/accountOpportunityUtils.js";

test("account opportunity uses the supply site canonical path", () => {
  assert.deepEqual(buildAccountOpportunityPaths("2026-08-31"), {
    yearMonth: "2026-08",
    rawFilePath: "account-opportunity/2026-08-31.md",
    pagePath: "content/cn/account-opportunity/2026-08/2026-08-31.md",
    monthDirectoryIndexPath: "content/cn/account-opportunity/2026-08/_index.md",
    homePath: "content/cn/account-opportunity/_index.md",
    publicPath: "/opportunities/2026-08-31",
  });
});

test("account opportunity resolves an isolated GitHub target without mutating daily config", () => {
  const env = {
    GITHUB_REPO_OWNER: "daily-owner",
    GITHUB_REPO_NAME: "daily-repo",
    GITHUB_BRANCH: "main",
    ACCOUNT_OPPORTUNITY_GITHUB_REPO_OWNER: "supply-owner",
    ACCOUNT_OPPORTUNITY_GITHUB_REPO_NAME: "supply-repo",
    ACCOUNT_OPPORTUNITY_GITHUB_BRANCH: "merchant-daily",
  };

  const resolved = resolveAccountOpportunityGitHubEnv(env);
  assert.equal(resolved.GITHUB_REPO_OWNER, "supply-owner");
  assert.equal(resolved.GITHUB_REPO_NAME, "supply-repo");
  assert.equal(resolved.GITHUB_BRANCH, "merchant-daily");
  assert.equal(env.GITHUB_REPO_NAME, "daily-repo");
});
