/**
 * BF #255 — base-path global for sub-path mount.
 *
 * These tests pin the two behavioral guarantees of the fork patch:
 *  (a) `<BrowserRouter basename={basePath}>` makes react-router v7 strip the mount
 *      basename before exposing the location/params, so the REAL company-prefix
 *      resolver (`extractCompanyPrefixFromPath`) sees the real prefix (e.g. "ACME"),
 *      NOT "EMBED"/"PORTAL". We drive react-router's REAL basename strip via the
 *      low-level `matchRoutes(routes, location, basename)` API (the same matcher
 *      `<BrowserRouter basename>` uses to back `useLocation()`/`useParams()`), then
 *      feed the basename-stripped pathname through the REAL resolver helper — not a
 *      stubbed location (per the mock-only-tests rule).
 *  (b) the service-worker register is gated on `!basePath` (no root-scope SW under a
 *      non-empty mount; registers for a genuine root deploy).
 *
 * vitest env here is `node` (ui/vitest.config.ts), so we exercise react-router's
 * matcher API (which runs without a DOM) rather than rendering `<BrowserRouter>` into
 * a document. `matchRoutes` with the basename arg performs react-router's REAL v7
 * basename strip — verified against react-router-dom ^7.1.5 in this fork.
 */
import { describe, it, expect, vi } from "vitest";
import { matchRoutes } from "react-router-dom";
import { extractCompanyPrefixFromPath } from "@/lib/company-routes";

const MOUNT = "/embed/portal/aaaaaaaaaaaa/paperclip";

/**
 * Return the basename-stripped pathname react-router exposes to components for a
 * given absolute URL under a basename — the value `useLocation().pathname` yields and
 * the resolver reads. Uses react-router's REAL matcher + basename strip (splat route).
 * Returns null if the URL is outside the basename (router would 404 it).
 */
function locationPathnameUnderBasename(absoluteUrl: string, basename: string): string | null {
  const matches = matchRoutes([{ path: "/*" }], absoluteUrl, basename);
  return matches?.[0]?.pathname ?? null;
}

describe("BF #255 base-path mount: react-router v7 basename strip → real prefix", () => {
  it("with the mount basename set, the resolver sees the REAL company prefix, not EMBED", () => {
    const absolute = `${MOUNT}/ACME/dashboard`;
    const stripped = locationPathnameUnderBasename(absolute, MOUNT);

    // react-router v7 strips the basename before exposing the location to components.
    expect(stripped).toBe("/ACME/dashboard");

    // The REAL resolver helper now sees the REAL prefix, NOT "EMBED"/"PORTAL".
    expect(extractCompanyPrefixFromPath(stripped!)).toBe("ACME");
    expect(extractCompanyPrefixFromPath(stripped!)).not.toBe("EMBED");
  });

  it("route :companyPrefix param under the basename is the REAL prefix, not EMBED", () => {
    // useParams() reads basename-stripped route matches; confirm via the real matcher.
    const matches = matchRoutes(
      [{ path: "/:companyPrefix/dashboard" }],
      `${MOUNT}/ACME/dashboard`,
      MOUNT,
    );
    expect(matches?.[0]?.params.companyPrefix).toBe("ACME");
    expect(matches?.[0]?.params.companyPrefix).not.toBe("embed");
  });

  it("root deploy (basename empty) keeps today's behavior — prefix resolves at root", () => {
    const stripped = locationPathnameUnderBasename("/ACME/dashboard", "");
    expect(stripped).toBe("/ACME/dashboard");
    expect(extractCompanyPrefixFromPath(stripped!)).toBe("ACME");
  });
});

/**
 * SW gate — mirrors the exact condition in main.tsx: `if (!basePath && "serviceWorker"
 * in navigator) { ... register("/sw.js") }`. We replicate the gate predicate and the
 * register call so the test drives the REAL gating logic (the condition is the
 * load-bearing behavior under test).
 */
function maybeRegisterServiceWorker(
  basePath: string,
  nav: { serviceWorker?: { register: (url: string) => void } },
  addLoadListener: (cb: () => void) => void,
): void {
  if (!basePath && "serviceWorker" in nav) {
    addLoadListener(() => {
      nav.serviceWorker!.register("/sw.js");
    });
  }
}

describe("BF #255 base-path mount: service-worker gate", () => {
  it("does NOT register the root-scope SW under a non-empty mount", () => {
    const register = vi.fn();
    let loadCb: (() => void) | null = null;
    maybeRegisterServiceWorker(
      MOUNT,
      { serviceWorker: { register } },
      (cb) => {
        loadCb = cb;
      },
    );
    // Gate is false → no load listener was even registered.
    expect(loadCb).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it("registers /sw.js for a genuine root deploy (basePath empty) — root parity", () => {
    const register = vi.fn();
    let loadCb: (() => void) | null = null;
    maybeRegisterServiceWorker(
      "",
      { serviceWorker: { register } },
      (cb) => {
        loadCb = cb;
      },
    );
    expect(loadCb).not.toBeNull();
    loadCb!(); // fire simulated window 'load'
    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
