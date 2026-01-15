# Deployment Guide: Cloudflare Pages

This project is configured for **Static Export**, making it easy to deploy on
Cloudflare Pages.

## Connecting to Cloudflare Pages

Follow these steps to set up auto-deployment from your GitHub repository.

### GitHub Prerequisites

You'll need to give the Cloudflare GitHub app access to any repository you want
to deploy.

As of 2025-01-10, this is configured in your GitHub personal settings, under
"Applications" in the left sidebar.

### Cloudflare Steps

1. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), create a new
    application from the **Workers & Pages** section.
2. Select the **Looking to deploy a page? Get Started** link and use the
    **Next.js** preset.
3. Take the opportunity to create a custom subdomain for the deployment.

## Automatic Builds

Once connected, every time you `git push` to the `main` branch, Cloudflare will
automatically:

1. Pull the latest code.
2. Run `npm install`.
3. Run `npm run build`.
4. Deploy the contents of the `out` directory to your global edge network.

## Local Verification

You can verify the build locally by running:

```bash
npm run build
```

The static files will be generated in the `out/` directory.
