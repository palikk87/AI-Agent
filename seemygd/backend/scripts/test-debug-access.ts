/**
 * Tests for the /detect debug gate. No network, no API key.
 *
 *   bun run scripts/test-debug-access.ts
 *
 * The trace exposes the gridded source images, which are the customer's own
 * photo of their house. The rule this file defends is: no secret, no trace —
 * and in particular, a missing or blank DEBUG_TRACE_SECRET must deny rather
 * than wave everything through.
 */
import { DEBUG_SECRET_ENV, DEBUG_SECRET_HEADER, resolveTraceMode, secretMatches } from "../src/debug-access";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const SECRET = "s3cret-value-for-tests";

console.log("\nfail closed when no secret is configured");
check("undefined env denies, even with a header", resolveTraceMode("images", SECRET, undefined) === undefined);
check("blank env denies", resolveTraceMode("images", SECRET, "") === undefined);
check("blank env denies a blank header too", resolveTraceMode("images", "", "") === undefined);
check("secretMatches denies when expected is undefined", !secretMatches(SECRET, undefined));
check("secretMatches denies when expected is blank", !secretMatches(SECRET, ""));

console.log("\nno secret supplied by the caller");
check("missing header denies", resolveTraceMode("images", undefined, SECRET) === undefined);
check("blank header denies", resolveTraceMode("images", "", SECRET) === undefined);
check("wrong secret denies", resolveTraceMode("images", "not-the-secret", SECRET) === undefined);
check("secret that is a prefix denies", resolveTraceMode("images", SECRET.slice(0, -1), SECRET) === undefined);
check("secret with trailing space denies", resolveTraceMode("images", SECRET + " ", SECRET) === undefined);
check("longer string containing the secret denies", resolveTraceMode("images", SECRET + "extra", SECRET) === undefined);
// Same length, different content — this is the only case that reaches the
// constant-time compare. Without it a prefix or partial match would pass unseen.
const sameLenWrong = SECRET.slice(0, -1) + (SECRET.endsWith("x") ? "y" : "x");
check("same-length wrong secret denies", sameLenWrong.length === SECRET.length && resolveTraceMode("images", sameLenWrong, SECRET) === undefined);
check("same-length secret differing only in first char denies",
  resolveTraceMode("images", "X" + SECRET.slice(1), SECRET) === undefined);
check("secretMatches rejects same-length mismatch", !secretMatches(sameLenWrong, SECRET));

console.log("\nauthorised callers still get what they asked for");
check("correct secret + debug=images returns images", resolveTraceMode("images", SECRET, SECRET) === "images");
check("correct secret + debug=1 returns true", resolveTraceMode("1", SECRET, SECRET) === true);
check("correct secret + any other debug value returns true", resolveTraceMode("yes", SECRET, SECRET) === true);

console.log("\nno debug requested means no trace, authorised or not");
check("no debug param, correct secret", resolveTraceMode(undefined, SECRET, SECRET) === undefined);
check("no debug param, no secret", resolveTraceMode(undefined, undefined, SECRET) === undefined);
check("empty debug param denies", resolveTraceMode("", SECRET, SECRET) === undefined);

console.log("\nmechanics");
check("length mismatch does not throw", (() => {
  try {
    secretMatches("a", "aaaaaaaaaaaaaaaaaaaa");
    secretMatches("aaaaaaaaaaaaaaaaaaaa", "a");
    return true;
  } catch {
    return false;
  }
})());
check("exact match succeeds", secretMatches(SECRET, SECRET));
check("header name is lowercase (Hono normalises)", DEBUG_SECRET_HEADER === DEBUG_SECRET_HEADER.toLowerCase());
check("env var name is documented and not a real value", DEBUG_SECRET_ENV === "DEBUG_TRACE_SECRET");

console.log("\nthe env default itself denies (exercises the real code path)");
{
  // Every case above passes expectedSecret explicitly, which never runs the
  // default parameter that reads process.env. Drive that path directly, or a
  // hardcoded fallback added there would go unnoticed.
  const saved = process.env[DEBUG_SECRET_ENV];
  delete process.env[DEBUG_SECRET_ENV];
  check("unset env denies via the default parameter", resolveTraceMode("images", "any-guess") === undefined);
  check("unset env denies even a plausible secret", resolveTraceMode("images", "dev-secret") === undefined);
  process.env[DEBUG_SECRET_ENV] = "";
  check("blank env denies via the default parameter", resolveTraceMode("images", "any-guess") === undefined);
  process.env[DEBUG_SECRET_ENV] = SECRET;
  check("configured env authorises via the default parameter", resolveTraceMode("images", SECRET) === "images");
  check("configured env still denies a wrong secret", resolveTraceMode("images", "nope") === undefined);
  if (saved === undefined) delete process.env[DEBUG_SECRET_ENV];
  else process.env[DEBUG_SECRET_ENV] = saved;
}

console.log("\nno secret value is committed to the repo");
{
  const src = await Bun.file(new URL("../src/debug-access.ts", import.meta.url)).text();
  // No fallback on either the literal name or the constant that holds it.
  check("debug-access.ts has no fallback secret",
    !/(DEBUG_TRACE_SECRET|DEBUG_SECRET_ENV)\s*\]?\s*(\|\||\?\?)\s*["'`]/.test(src));
  const envExample = await Bun.file(new URL("../.env.example", import.meta.url)).text().catch(() => "");
  const line = envExample.split("\n").find((l) => l.startsWith("DEBUG_TRACE_SECRET"));
  check(
    ".env.example documents the var without a value",
    !line || /^DEBUG_TRACE_SECRET=\s*$/.test(line),
    line ? `found: ${line}` : "not present"
  );
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures})`}\n`);
process.exit(failures === 0 ? 0 : 1);
