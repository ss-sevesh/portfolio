# Sevesh SS — Portfolio

Interactive 3D portfolio. The background is a synthetic scan volume (Three.js points + a custom shader) that rotates and spreads its slices as you scroll, with a teal "segmented region" and a slice counter in the corner.

## Stack
- Vite 6 (static build, no framework needed for a single-page portfolio)
- Three.js for the WebGL scene
- Plain HTML/CSS with design tokens in `src/style.css`
- ESLint + Prettier, GitHub Actions CI (lint + build)

## Develop
```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build    # outputs dist/
```

## Deploy
Import the repo in [Vercel](https://vercel.com/new). Framework preset: Vite. Build command `npm run build`, output `dist`. No environment variables are needed.

## Editing content
All copy lives in `index.html`. Project links point at the GitHub repos; add your HuggingFace Space URL on the Polyp Segmentation card when you have it.
