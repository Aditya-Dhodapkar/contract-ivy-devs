// Environment-aware headless-Chromium launcher for the brochure renderer.
//
// The problem this solves: the full `puppeteer` package bundles a ~170 MB
// Chromium that (a) exceeds Vercel's serverless function size limit and
// (b) can't locate its executable in the Lambda filesystem. So a brochure
// that renders fine locally 500s the moment it's deployed.
//
// The fix — pick the browser by environment:
//   • Serverless (Vercel / AWS Lambda): puppeteer-core + @sparticuz/chromium,
//     a brotli-compressed Chromium built to fit the Lambda size budget.
//   • Local dev: the full `puppeteer` package's bundled Chromium. It's a
//     devDependency, so it never ships to prod — but it keeps `npm run dev`
//     zero-config for the next developer (no system Chrome to install).
//
// Detection: Vercel sets VERCEL=1 in every deployed environment; AWS Lambda
// sets AWS_LAMBDA_FUNCTION_NAME. Neither is present under `npm run dev`.

import type { Browser } from "puppeteer-core";

/** True when running inside Vercel's (or a raw AWS Lambda) serverless
 *  runtime — where the bundled-Chromium puppeteer can't run. */
function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Launch a headless Chromium suited to the current environment. The caller
 *  owns the returned browser and MUST `await browser.close()` in a finally. */
export async function launchBrowser(): Promise<Browser> {
  if (isServerless()) {
    // Prod path. puppeteer-core has no bundled browser; @sparticuz/chromium
    // supplies the Lambda-compatible executable + the flags it needs.
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local-dev path. `puppeteer` is a devDependency (absent in prod), so it's
  // imported dynamically — this line only ever runs locally, where it's
  // installed. The cast bridges puppeteer's Browser type to puppeteer-core's;
  // puppeteer re-exports the same browser, so they're structurally identical.
  const { default: puppeteer } = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as unknown as Promise<Browser>;
}
