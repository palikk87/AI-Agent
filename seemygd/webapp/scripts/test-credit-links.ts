/**
 * Compliance tests for the outbound credit link. No network, no API key.
 *
 *   bun run scripts/test-credit-links.ts
 *
 * Two rules, both of which are compliance constraints rather than preferences:
 *
 *   (a) Every credit anchor we render onto a page we do not own — the host page
 *       via embed.js, the /v/:slug page framed into customer sites, and the
 *       snippets customers paste — carries rel="nofollow". Injecting followed
 *       links across distributed third-party sites is the pattern Google's
 *       link-spam policy names, whichever of our domains they point at.
 *
 *   (b) Nothing the widget puts on a third-party page links to 941garagedoor.com
 *       at all. The single backlink to 941 lives on seemygd.com's own page and
 *       is deliberate; it is out of scope here and must not be "fixed".
 *
 * embed.js is exercised by actually running it in a DOM, not by reading it, so
 * these assertions cover the real rendered anchors on all three of its paths —
 * fresh page, legacy cmygd anchor, and an anchor the site owner already pasted.
 */
import { Window } from "happy-dom";
import { readFileSync } from "fs";
import { join } from "path";
import { CREDIT_HREF, CREDIT_ID, CREDIT_REL, CREDIT_TEXT, creditAnchorHtml, creditAnchorProps } from "../src/lib/credit";

const ROOT = join(import.meta.dir, "..");
const EMBED_SRC = readFileSync(join(ROOT, "public/embed.js"), "utf8");
const VISUALIZER_SRC = readFileSync(join(ROOT, "src/pages/Visualizer.tsx"), "utf8");
const DASHBOARD_SRC = readFileSync(join(ROOT, "src/pages/Dashboard.tsx"), "utf8");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Run embed.js against a host page and return the resulting document. */
async function runEmbed(bodyHtml: string) {
  const win = new Window({ url: "https://a-customer-site.example/" });
  const doc = win.document;
  doc.body.innerHTML = bodyHtml;

  // Stand in for the <script src=".../embed.js" data-slug="..."> tag.
  const tag = doc.createElement("script");
  tag.setAttribute("src", "https://seemygd.onrender.com/embed.js");
  tag.setAttribute("data-slug", "cmrwhk9sa0000pn550sm337gd");
  doc.body.appendChild(tag);
  Object.defineProperty(doc, "currentScript", { value: tag, configurable: true });

  // Run the real script with the fake page's globals in scope. Executing it
  // rather than reading it is the point: these assertions are about the anchors
  // that actually end up in the DOM, on every path through addCredit().
  const run = new Function("window", "document", "console", "URL", "requestAnimationFrame", EMBED_SRC);
  run(win, doc, console, URL, (cb: () => void) => setTimeout(cb, 0));
  await new Promise((r) => setTimeout(r, 30));
  return doc;
}

/** Every anchor pointing at one of our domains, as actually rendered. */
function outboundAnchors(doc: any) {
  return Array.from(doc.querySelectorAll("a")).filter((a: any) =>
    /seemygd\.com|cmygd\.com|941garagedoor\.com/i.test(a.getAttribute("href") || "")
  );
}

console.log("\n(a) rel=nofollow on every anchor embed.js renders onto a host page");
{
  const cases: Array<{ name: string; body: string }> = [
    { name: "fresh page — credit injected", body: "<p>a customer's site</p>" },
    {
      name: "legacy cmygd anchor — self-healed in place",
      body: '<a id="cmygd-credit" href="https://cmygd.com" rel="noopener">Visualizer powered by cmygd</a>',
    },
    {
      name: "legacy cmygd anchor matched by text, no id",
      body: '<a href="https://cmygd.com" rel="noopener">powered by cmygd</a>',
    },
    {
      name: "credit already pasted by the site owner — adopted and qualified",
      body: `<a id="${CREDIT_ID}" href="${CREDIT_HREF}" target="_blank" rel="noopener">${CREDIT_TEXT}</a>`,
    },
    {
      name: "pasted credit with no rel at all",
      body: `<a id="${CREDIT_ID}" href="${CREDIT_HREF}">${CREDIT_TEXT}</a>`,
    },
    {
      name: "host page has its own [data-doorviz] trigger",
      body: '<button data-doorviz="true">Visualize My Door</button>',
    },
  ];

  for (const { name, body } of cases) {
    const doc = await runEmbed(body);
    const anchors = outboundAnchors(doc);
    check(
      `${name} — ${anchors.length} credit anchor(s), all nofollow`,
      anchors.length > 0 && anchors.every((a: any) => /\bnofollow\b/i.test(a.getAttribute("rel") || "")),
      anchors.length === 0
        ? "no credit anchor rendered at all"
        : `rel values: ${anchors.map((a: any) => JSON.stringify(a.getAttribute("rel"))).join(", ")}`
    );
    // noopener must survive alongside nofollow — it is security, not SEO.
    check(
      `${name} — noopener preserved`,
      anchors.every((a: any) => /\bnoopener\b/i.test(a.getAttribute("rel") || ""))
    );
    // The credit has to remain visible and clickable; qualifying it is not hiding it.
    check(
      `${name} — credit still present and clickable`,
      anchors.every((a: any) => (a.getAttribute("href") || "").length > 0 && (a.textContent || "").trim().length > 0)
    );
  }
}

console.log("\n(a) rel=nofollow on the /v/:slug page and the pasted snippets");
{
  const props = creditAnchorProps();
  check("creditAnchorProps() is nofollow", /\bnofollow\b/.test(props.rel));
  check("creditAnchorProps() keeps noopener", /\bnoopener\b/.test(props.rel));
  check("creditAnchorHtml() is nofollow", /rel="[^"]*\bnofollow\b/.test(creditAnchorHtml()));
  check("creditAnchorHtml({withId}) is nofollow", /rel="[^"]*\bnofollow\b/.test(creditAnchorHtml({ withId: true })));

  // The /v/ page must not hand-roll an anchor that bypasses the helper.
  const rawVisualizerAnchors = [...VISUALIZER_SRC.matchAll(/<a\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => /seemygd\.com/i.test(tag));
  check(
    "/v/ page has no hand-written seemygd anchor bypassing the helper",
    rawVisualizerAnchors.length === 0,
    rawVisualizerAnchors.join(" | ")
  );
  check("/v/ page uses creditAnchorProps()", VISUALIZER_SRC.includes("creditAnchorProps()"));

  // Same for the snippets the dashboard gives customers to paste.
  const rawDashAnchors = [...DASHBOARD_SRC.matchAll(/<a\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => /seemygd\.com/i.test(tag));
  check(
    "pasted snippets have no hand-written seemygd anchor",
    rawDashAnchors.length === 0,
    rawDashAnchors.join(" | ")
  );
  check("pasted snippets use creditAnchorHtml()", DASHBOARD_SRC.includes("creditAnchorHtml("));
}

console.log("\n(a) embed.js cannot drift from the shared definition");
{
  check("embed.js declares the same rel string", EMBED_SRC.includes(`CREDIT_REL = "${CREDIT_REL}"`), `expected ${CREDIT_REL}`);
  check("embed.js declares the same href", EMBED_SRC.includes(`CREDIT_HREF = "${CREDIT_HREF}"`));
  check("embed.js declares the same id", EMBED_SRC.includes(`CREDIT_ID = "${CREDIT_ID}"`));
  // Every anchor path must go through the one helper.
  check("embed.js routes anchors through applyCreditAttrs()", EMBED_SRC.includes("function applyCreditAttrs("));
  const relAssignments = [...EMBED_SRC.matchAll(/\.rel\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
  check(
    "embed.js sets .rel only from CREDIT_REL",
    relAssignments.length > 0 && relAssignments.every((v) => v === "CREDIT_REL"),
    `found: ${relAssignments.join(", ") || "none"}`
  );
}

console.log("\n(b) no 941garagedoor link reachable from embed.js or any /v/ route");

/**
 * Strip comment-only lines before scanning for the domain.
 *
 * The rule is that no 941garagedoor URL is reachable, not that the string may
 * never be typed — credit.ts documents the rule and names the domain doing so.
 * Comment lines are dropped rather than the comment being watered down, and
 * only whole-line comments are dropped, so a URL in real code is never hidden
 * by a "//" inside a string literal.
 */
function codeOnly(src: string) {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
}

{
  check("embed.js contains no 941garagedoor reference", !/941garagedoor/i.test(codeOnly(EMBED_SRC)));
  check("/v/ page source contains no 941garagedoor reference", !/941garagedoor/i.test(codeOnly(VISUALIZER_SRC)));
  check(
    "credit helper contains no 941garagedoor href",
    !/941garagedoor/i.test(codeOnly(readFileSync(join(ROOT, "src/lib/credit.ts"), "utf8")))
  );

  // And prove it at runtime: nothing embed.js renders points at 941.
  const doc = await runEmbed("<p>a customer's site</p>");
  const to941 = Array.from(doc.querySelectorAll("a")).filter((a: any) =>
    /941garagedoor/i.test(a.getAttribute("href") || "")
  );
  check("embed.js renders no anchor to 941garagedoor", to941.length === 0);

  // Walk what the /v/ route actually pulls in, so a link added to a shared
  // component is caught too — a check that only reads Visualizer.tsx would miss it.
  const seen = new Set<string>();
  const offenders: string[] = [];
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    let src: string;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      return;
    }
    if (/941garagedoor/i.test(codeOnly(src))) offenders.push(file.replace(ROOT + "/", ""));
    for (const m of src.matchAll(/from\s+["'](@\/[^"']+)["']/g)) {
      const base = join(ROOT, "src", m[1].slice(2));
      for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) walk(base + ext);
    }
  };
  walk(join(ROOT, "src/pages/Visualizer.tsx"));
  check(
    `/v/ dependency graph is free of 941garagedoor (${seen.size} files walked)`,
    offenders.length === 0,
    offenders.join(", ")
  );
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures})`}\n`);
process.exit(failures === 0 ? 0 : 1);
