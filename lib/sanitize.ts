import sanitizeHtml from "sanitize-html";

// Allow-list for user comment HTML. Everything else is stripped. This runs
// server-side at write time; rendered comment HTML is always this function's
// output, never raw user input.
export function sanitizeCommentHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? "", {
    allowedTags: ["b", "strong", "i", "em", "u", "ul", "ol", "li", "a", "br", "p", "span"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  });
}
