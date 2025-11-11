# Release Guide for Frontmatter Suggester

## Prerequisites

1. Plugin built successfully (`npm run build`)
2. All changes committed to GitHub
3. Version numbers updated in both `package.json` and `manifest.json`

## Publishing Steps

### 1. Create GitHub Repository

If not already done:

```bash
cd /path/to/frontmatter-suggester
git init
git add .
git commit -m "Initial commit - v1.1.0"
git branch -M main
git remote add origin https://github.com/javenfang/obsidian-frontmatter-suggester.git
git push -u origin main
```

### 2. Create GitHub Release

1. Go to your repository on GitHub
2. Click "Releases" → "Create a new release"
3. Set tag version: `1.1.0`
4. Release title: `v1.1.0`
5. Add release notes describing features
6. **Attach these files:**
   - `main.js`
   - `manifest.json`
   - `styles.css` (if exists)

### 3. Submit to Obsidian Plugin Marketplace

1. Fork the official repository:
   https://github.com/obsidianmd/obsidian-releases

2. Add your plugin to `community-plugins.json`:

```json
{
  "id": "frontmatter-suggester",
  "name": "Frontmatter Auto-Suggest",
  "author": "Javen Fang",
  "description": "Auto-suggest for frontmatter fields with multi-select support and customizable options",
  "repo": "javenfang/obsidian-frontmatter-suggester"
}
```

3. Create Pull Request with title:
   "Add Frontmatter Auto-Suggest plugin"

4. Wait for review (typically 1-2 weeks)

### 4. After Approval

Once approved, users can install directly from Obsidian:
- Settings → Community Plugins → Browse
- Search "Frontmatter Auto-Suggest"

## Release Checklist

- [ ] Version numbers match in `package.json` and `manifest.json`
- [ ] `npm run build` completes successfully
- [ ] README.md is up to date
- [ ] LICENSE file exists
- [ ] All features tested
- [ ] GitHub repository created
- [ ] GitHub release created with required files
- [ ] Pull request submitted to obsidian-releases

## Future Releases

For subsequent releases:

1. Update version in `package.json` and `manifest.json`
2. Build: `npm run build`
3. Commit changes
4. Create new GitHub release with updated files
5. Plugin marketplace updates automatically

## Notes

- First release requires manual approval
- Subsequent releases auto-update once approved
- Keep `main.js`, `manifest.json`, and `styles.css` in version control
- Minimum Obsidian version: 0.15.0 (set in manifest.json)
