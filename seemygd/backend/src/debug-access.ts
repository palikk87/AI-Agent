import { timingSafeEqual } from "crypto";

/**
 * Gate for the /detect diagnostic trace.
 *
 * The trace is genuinely useful — it is what found the missing fonts in the
 * production image and the crop that was clamping every refined box — so it
 * stays. But ?debug=images returns the gridded source images, and those are
 * photographs of customers' own houses. Anyone who guessed the query string got
 * them. So the capability is kept and the access is gated.
 *
 * Three deliberate choices:
 *
 *   Fail closed. If DEBUG_TRACE_SECRET is unset or blank the trace is off
 *   entirely. A missing variable must never mean "no check" — that is how this
 *   sort of gate quietly stops gating after a config change.
 *
 *   Header, not query string. Query strings end up in access logs, proxy logs,
 *   browser history and Referer headers; a secret in one is a secret leaked to
 *   everything in the request path.
 *
 *   Constant-time compare, so a caller cannot recover the secret byte by byte
 *   from how long the comparison takes.
 */
export const DEBUG_SECRET_HEADER = "x-debug-secret";
export const DEBUG_SECRET_ENV = "DEBUG_TRACE_SECRET";

/** Constant-time string compare that does not leak length through timing. */
export function secretMatches(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected) return false; // fail closed: no secret configured, no trace
  if (!provided) return false;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on length mismatch, so compare digests of equal size
  // rather than branching on length.
  if (a.length !== b.length) {
    // Still do a comparison of equal-length buffers so the work is constant.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * What the caller is allowed to see. Returns undefined when the trace is not
 * authorised, so the caller gets the ordinary response with no trace and no
 * images rather than an error — an unauthenticated probe should learn nothing,
 * including whether the capability exists.
 */
export function resolveTraceMode(
  debugParam: string | undefined,
  providedSecret: string | undefined,
  expectedSecret: string | undefined = process.env[DEBUG_SECRET_ENV]
): true | "images" | undefined {
  if (!debugParam) return undefined;
  if (!secretMatches(providedSecret, expectedSecret)) return undefined;
  return debugParam === "images" ? "images" : true;
}
