# Deployment Guide: Cloudflare Pages

This project is configured for **Static Export**, making it easy to deploy on Cloudflare Pages.

## Connecting to Cloudflare Pages

Follow these steps to set up auto-deployment from your GitHub repository:

1.  **Log in to Cloudflare**: Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  **Navigate to Workers & Pages**: Click on "Workers & Pages" in the sidebar.
3.  **Create a Project**:
    *   Click **Create application**.
    *   Select the **Pages** tab.
    *   Click **Connect to Git**.
4.  **Select Repository**: Select your GitHub account and then the `xox` (or `xox-16-playback-engine`) repository.
5.  **Configure Build Settings**:
    *   **Project name**: (Choose any name)
    *   **Production branch**: `main`
    *   **Framework preset**: Select **Next.js** (Cloudflare will detect the configuration).
    *   **Build command**: `npm run build`
    *   **Build output directory**: `out` (This is the default for `output: 'export'`)
6.  **Deploy**: Click **Save and Deploy**.

## Automatic Builds

Once connected, every time you `git push` to the `main` branch, Cloudflare will automatically:
1.  Pull the latest code.
2.  Run `npm install`.
3.  Run `npm run build`.
4.  Deploy the contents of the `out` directory to your global edge network.

## Local Verification

You can verify the build locally by running:

```bash
npm run build
```

The static files will be generated in the `out/` directory.
