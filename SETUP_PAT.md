# Setup Personal Access Token for Semantic Release

## Why

By default, semantic-release uses `GITHUB_TOKEN` which creates commits as `semantic-release-bot`. 
To make commits appear as your own user, you need a Personal Access Token.

## Steps

### 1. Create a Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: `semantic-release`
4. Expiration: 90 days (or as needed)
5. Select scopes:
   - `repo` (full control of private repositories)
   - `workflow` (update GitHub Action workflows)
6. Click "Generate token"
7. Copy the token immediately (it won't be shown again)

### 2. Add to GitHub Secrets

1. Go to https://github.com/devcristianlopez/manel/settings/secrets/actions
2. Click "New repository secret"
3. Name: `PERSONAL_TOKEN`
4. Value: paste your token
5. Click "Add secret"

### 3. Verify

After the next push to main, semantic-release will use your PAT.
Commits will appear under your GitHub username.

## Important Notes

- PATs expire - set a reminder to renew
- Never commit the token to the repository
- The token is only used by GitHub Actions
