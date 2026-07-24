// render/fallback.ts — `fallbackSvg(msg)` (design/06 §3, carried): the
// minimal valid self-contained SVG `renderTopdown`'s catch-all wraps to.
// `renderTopdown` never throws — this is what it returns instead.

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FALLBACK_W = 400;
const FALLBACK_H = 120;

/** A minimal, well-formed, self-contained SVG carrying the failure message as text — never an exception. */
export function fallbackSvg(msg: string): string {
  const text = escapeXml(msg);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FALLBACK_W}" height="${FALLBACK_H}" ` +
    `viewBox="0 0 ${FALLBACK_W} ${FALLBACK_H}" role="img" aria-label="render failed">` +
    `<rect x="0" y="0" width="${FALLBACK_W}" height="${FALLBACK_H}" fill="#f4f4f4" stroke="#b32e2e" stroke-width="2"/>` +
    `<text x="12" y="64" font-family="sans-serif" font-size="14" fill="#b32e2e">render failed: ${text}</text>` +
    `</svg>`
  );
}
