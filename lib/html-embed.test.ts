import { describe, it, expect } from "vitest";
import { injectHeightReporter, stripHeightReporter, HTML_HEIGHT_MESSAGE } from "./html-embed";

describe("html-embed reporter", () => {
  it("injects the reporter before </body>", () => {
    const out = injectHeightReporter("<html><body><h1>Hi</h1></body></html>");
    expect(out).toContain(HTML_HEIGHT_MESSAGE);
    expect(out.indexOf(HTML_HEIGHT_MESSAGE)).toBeLessThan(out.indexOf("</body>"));
  });

  it("appends the reporter when there is no </body>", () => {
    const out = injectHeightReporter("<h1>Hi</h1>");
    expect(out.startsWith("<h1>Hi</h1>")).toBe(true);
    expect(out).toContain(HTML_HEIGHT_MESSAGE);
  });

  it("strips only the reporter, preserving other scripts and the markup between them", () => {
    const page =
      '<html><body><script>window.analytics=1</script><main>content</main>';
    const injected = injectHeightReporter(page + "</body></html>");
    const stripped = stripHeightReporter(injected);
    // reporter gone…
    expect(stripped).not.toContain(HTML_HEIGHT_MESSAGE);
    // …but the page's own script and content survive intact
    expect(stripped).toContain("window.analytics=1");
    expect(stripped).toContain("<main>content</main>");
    expect(stripped).toContain("</body>");
  });

  it("strip + re-inject yields a single reporter (idempotent at view time)", () => {
    const once = injectHeightReporter("<body><p>x</p></body>");
    const twice = injectHeightReporter(stripHeightReporter(once));
    const count = twice.split(HTML_HEIGHT_MESSAGE).length - 1;
    expect(count).toBe(1);
  });

  it("does not corrupt a page whose script precedes the reporter", () => {
    const page = "<body><script>var a='</scriptish>';doStuff()</script><h1>Title</h1></body>";
    const injected = injectHeightReporter(page);
    const stripped = stripHeightReporter(injected);
    expect(stripped).toContain("<h1>Title</h1>");
    expect(stripped).toContain("doStuff()");
    expect(stripped).not.toContain(HTML_HEIGHT_MESSAGE);
  });
});
