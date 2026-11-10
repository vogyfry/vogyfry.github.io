---
applyTo: "**"
---

# Vogyfry GitHub Pages — Copilot Instructions

## Architecture

This repo (`vogyfry.github.io`) is the **landing page** for all apps by Jim Vogl. Each app has its own separate private repo with a `website/` subfolder deployed via GitHub Actions to GitHub Pages with a custom domain.

### Repo Map

| App | Repo | Branch | Website Source | Custom Domain |
|---|---|---|---|---|
| Landing Page | `vogyfry/vogyfry.github.io` | `main` | root `/` | `vogyfry.github.io` |
| TradeSocial | `vogyfry/tradesocial` | `master` | `website/` | `tradesocial.app` |
| Mavee | `vogyfry/mylife` | `main` | `website/` | `ma-vee.app` |
| Pravida | `vogyfry/private-network` | `main` | `website/` | `pravida.app` |

### How Each Site Deploys

- Each app repo has `.github/workflows/deploy-website.yml`
- The workflow uploads ONLY `./website/` as a GitHub Pages artifact
- Source code in the repo is **never exposed** — only the `website/` folder is published
- Custom domain is set via `website/CNAME` file containing the domain name
- GitHub Pages is configured with `build_type: workflow` and HTTPS enforced

## Adding a New App Site

Follow these steps exactly when adding a new app with its own website:

### 1. Create the website folder in the app repo

```
your-app-repo/
├── website/
│   ├── CNAME              # Contains: yourdomain.app
│   ├── index.html
│   ├── privacy.html
│   ├── terms.html
│   ├── styles.css
│   └── images/
│       ├── favicon.png
│       ├── logo.png
│       └── og-image.png
├── .github/
│   └── workflows/
│       └── deploy-website.yml
└── ... (app source code)
```

### 2. Create the deploy workflow

Create `.github/workflows/deploy-website.yml`:

```yaml
name: Deploy Website to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'website/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './website'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 3. Enable GitHub Actions on the repo

```bash
gh api repos/vogyfry/REPO_NAME/actions/permissions -X PUT --input - <<'EOF'
{"enabled": true, "allowed_actions": "all"}
EOF
```

### 4. Enable GitHub Pages with workflow deployment

```bash
gh api repos/vogyfry/REPO_NAME/pages -X POST --input - <<'EOF'
{"build_type": "workflow", "source": {"branch": "main", "path": "/"}}
EOF
```

### 5. Set the custom domain

```bash
gh api repos/vogyfry/REPO_NAME/pages -X PUT --input - <<'EOF'
{"cname": "yourdomain.app", "build_type": "workflow", "source": {"branch": "main", "path": "/"}}
EOF
```

### 6. Enforce HTTPS

```bash
gh api repos/vogyfry/REPO_NAME/pages -X PUT --input - <<'EOF'
{"https_enforced": true, "build_type": "workflow", "source": {"branch": "main", "path": "/"}}
EOF
```

### 7. Remove environment branch restrictions (if deploy gets stuck)

```bash
gh api repos/vogyfry/REPO_NAME/environments/github-pages -X PUT --input - <<'EOF'
{"deployment_branch_policy": null}
EOF
```

### 8. Configure DNS at your domain registrar

Add these A records for the apex domain:
- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

Add a CNAME record for `www` pointing to `vogyfry.github.io`.

### 9. Trigger the first deploy

```bash
gh workflow run deploy-website.yml --repo vogyfry/REPO_NAME
```

### 10. Update the landing page

Add a new app card to `vogyfry.github.io/index.html` and a corresponding icon image (`appname-icon.png`) to the repo root.

### 11. Add deploy task in VS Code

Add a new task entry in `.vscode/tasks.json` for the new site.

## Important Rules

- **Never put a CNAME file in the repo root** — it goes in `website/CNAME` only
- **Never put app source code in this landing page repo** — each app has its own repo
- **Only the `website/` folder is deployed** — nothing else in the repo is publicly accessible
- **All app repos must be private** — the published Pages site will be public but source code stays private
- **HTTPS must be enforced** on every custom domain
- **One custom domain per repo** — GitHub Pages only supports one CNAME per repository

## Product Page Footer Standard

Every product folder on pravalabs.app (`tradesocial/`, `toolport/`, `boatnavi/`, `pravida/`,
`echobridge/`, `mavee/`, `printrelay/`) follows these rules. The footer CSS is identical in
every product's `styles.css`; keep it that way.

1. **One footer per product, identical on every page in its folder:** index, privacy,
   support, terms, and any other page (Toolport's download and thanks). No separate short
   footer on subpages.
2. **Three columns in `.footer-grid`, exactly.** The grid is `2fr 1fr 1fr`; a fourth child
   wraps to a new row. No "Product" column of `#anchor` links: the top nav already has them,
   and anchors break on subpages.
   - **Brand:** `<div class="footer-brand"><img src="images/favicon.png" alt=""><span>Name</span></div>`
     then one `.footer-description` sentence that ends "By Prava Labs." The name is the one
     the page's `<title>` uses ("Prava PrintRelay", "Prava Toolport", "BoatNavi", ...).
   - **Help** (`<h4>Help</h4>`): Support, Privacy Policy, the terms page, support@pravalabs.app.
     The terms label matches that page's own title: "Terms of Service", except PrintRelay's
     "Terms of Use" (the app and App Store link to it as "Terms of Use (EULA)", guideline 3.1.2).
     Leave the terms link out only when the product has no terms page (BoatNavi, for now).
   - **Prava Labs** (`<h4>Prava Labs</h4>`): All Products (`/`), then every other public
     product in home-page order (TradeSocial, Toolport, BoatNavi, Pravida, EchoBridge, Mavee,
     PrintRelay), short names, leaving out the current product. Adding or removing a product
     means updating this column on every product's pages.
3. **Links are `<ul class="footer-links"><li><a>`** — bare `<a>` tags run together on one line.
4. **Bottom line:** `&copy; 2026 Prava Labs, LLC &nbsp;&middot;&nbsp; Made in California`.
   No repeated links, no "All rights reserved.", `·` separators only.
5. **Optional notice** — `<p class="footer-notice">` inside `.footer-bottom`, above the
   copyright, only for a required disclosure: TradeSocial "All trading is simulated.",
   Toolport's Stripe payment line and 14-day money-back guarantee.
6. **No inline styles** in footers. Add a class to `styles.css`, in all seven copies.
7. **Title Case** for footer labels and headings (Privacy Policy, Terms of Service, All Products).
8. **Mavee is published from `vogyfry/mylife` `website/`.** Its sync workflow overwrites
   `mavee/` here on every push to mylife `main` that touches `website/`, so make every Mavee
   change there (or copy it there in the same change).

The company home page (`/index.html`) has its own footer and is not covered by these rules.
