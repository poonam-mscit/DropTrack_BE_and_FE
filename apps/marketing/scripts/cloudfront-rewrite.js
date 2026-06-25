/**
 * CloudFront Function — viewer-request rewrite.
 *
 * Maps "pretty" URLs to the actual S3 keys produced by Next.js static export
 * with `trailingSlash: true`:
 *
 *   /about        → /about/index.html
 *   /about/       → /about/index.html
 *   /             → /index.html
 *   /sitemap.xml  → /sitemap.xml (untouched, has a file extension)
 *
 * Paste this into the AWS console:
 *   CloudFront → Functions → Create function (runtime: cloudfront-js-2.0)
 *   Then associate with the distribution under Behaviors → Viewer request.
 */
function handler(event) {
  var req = event.request;
  var uri = req.uri;

  // Already pointing at a file with an extension — leave it alone.
  if (uri.match(/\.[a-z0-9]+$/i)) return req;

  // Ensure trailing slash, then append index.html.
  if (!uri.endsWith('/')) uri += '/';
  req.uri = uri + 'index.html';
  return req;
}
