# Branch Protection Recommendations

After pushing to GitHub, configure the following branch protection rules to maintain code quality:

## For `main` Branch

Navigate to: **Settings → Branches → Add branch protection rule**

**Branch name pattern:** `main`

### Recommended Settings:

✅ **Require a pull request before merging**
- Require approvals: 1
- Dismiss stale pull request approvals when new commits are pushed
- Require review from Code Owners (optional, if you have CODEOWNERS file)

✅ **Require status checks to pass before merging**
- Require branches to be up to date before merging
- Status checks that are required:
  - `lint-and-test (18.x)`
  - `lint-and-test (20.x)`
  - `lint-and-test (22.x)`
  - `build-examples`

✅ **Require conversation resolution before merging**

✅ **Require linear history** (prevents merge commits)

✅ **Do not allow bypassing the above settings**
- Only administrators can bypass (you can enable this for yourself)

✅ **Include administrators** (apply rules to admins too)

## For `develop` Branch

**Branch name pattern:** `develop`

### Recommended Settings:

✅ **Require a pull request before merging**
- Require approvals: 1 (can be 0 for solo development)

✅ **Require status checks to pass before merging**
- Same status checks as `main`

✅ **Require conversation resolution before merging**

❌ **Require linear history** (can be disabled for develop to allow merge commits)

## Setting Up

1. Go to your repository on GitHub
2. Click **Settings** → **Branches**
3. Click **Add branch protection rule**
4. Configure for `main` first, then repeat for `develop`

## Auto-merge Setup (Optional)

For Dependabot PRs, you can enable auto-merge:

1. Go to **Settings → Code security and analysis**
2. Enable **Dependabot security updates**
3. Enable **Dependabot version updates**

This works with the Dependabot configuration already created.

---

**Note:** Branch protection ensures that all code going into `main` and `develop` is reviewed and tested, maintaining high code quality.
