/**
 * The outbound "powered by" credit link — one definition, used everywhere.
 *
 * COMPLIANCE, not styling. The widget places this link on pages we do not own,
 * across many customer sites at once. A followed link injected that way is the
 * pattern Google's link-spam policy names directly, and it counts against us
 * whichever of our own domains it points at. So every credit anchor that lands
 * on a third-party page carries rel="nofollow noopener".
 *
 * Two separate rules live here, and they are not the same rule:
 *
 *   1. Credit anchors on third-party pages are nofollow. That is this file.
 *   2. Nothing the widget places on a third-party page may link to
 *      941garagedoor.com at all. The only backlink to 941 lives on seemygd.com's
 *      own page, which is ours to link from and is deliberate.
 *
 * The link on seemygd.com's own site is NOT covered by rule 1 — a site linking
 * from its own pages is ordinary linking. Do not "fix" that one.
 *
 * embed.js cannot import this module: it is a standalone script served to
 * third-party pages, so it carries its own copy of these values and routes all
 * three of its anchor paths through a single applyCreditAttrs() helper.
 * scripts/test-credit-links.ts pins the two copies together and fails if they
 * drift.
 */

export const CREDIT_ID = "seemygd-credit";
export const CREDIT_HREF = "https://seemygd.com";
export const CREDIT_TEXT = "Visualizer powered by Seemygd";

/**
 * rel for every credit anchor rendered onto a page we do not own.
 * `nofollow` is the compliance requirement; `noopener` is the security hygiene
 * that has to survive alongside it.
 */
export const CREDIT_REL = "nofollow noopener";

/** Props for the credit anchor in React (the /v/:slug page). */
export function creditAnchorProps() {
  return {
    href: CREDIT_HREF,
    target: "_blank" as const,
    rel: CREDIT_REL,
  };
}

/**
 * The credit anchor as an HTML string, for the snippets the dashboard hands to
 * customers to paste onto their own sites. Built here rather than written out
 * by hand so a pasted snippet cannot drift from the rule.
 */
export function creditAnchorHtml(opts: { withId?: boolean; style?: string } = {}) {
  const id = opts.withId ? ` id="${CREDIT_ID}"` : "";
  const style = opts.style ? ` style="${opts.style}"` : "";
  const hover =
    ` onmouseover="this.style.textDecoration='underline'"` +
    ` onmouseout="this.style.textDecoration='none'"`;
  return (
    `<a${id} href="${CREDIT_HREF}" target="_blank" rel="${CREDIT_REL}"${style}${hover}>` +
    `${CREDIT_TEXT}</a>`
  );
}

/** Inline style used by the fixed-position credit in the pasted popup snippet. */
export const CREDIT_FIXED_STYLE =
  "position:fixed;right:12px;bottom:6px;z-index:2147483645;font-size:11px;" +
  "line-height:1;color:#9ca3af;text-decoration:none;" +
  "font-family:system-ui,-apple-system,sans-serif;";
