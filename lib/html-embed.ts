// Shared contract for rendering uploaded HTML mockups in a sandboxed iframe.
//
// The iframe is sandboxed WITHOUT allow-same-origin, so the parent cannot read
// the (cross-origin, opaque) document's height to lay pins over it. Instead we
// inject a tiny reporter into the uploaded file that postMessages its own
// scrollHeight to the parent; the viewer sizes the frame to that height so the
// whole page lays out (no inner scroll) and pin coordinates stay aligned.

export const HTML_HEIGHT_MESSAGE = "markitup:height";

const REPORTER = `<script>(function(){function h(){return Math.max(document.documentElement.scrollHeight||0,document.body?document.body.scrollHeight:0)}function r(){try{parent.postMessage({type:"${HTML_HEIGHT_MESSAGE}",height:h()},"*")}catch(e){}}window.addEventListener("load",r);window.addEventListener("resize",r);if(window.ResizeObserver){try{new ResizeObserver(r).observe(document.documentElement)}catch(e){}}var n=0,t=setInterval(function(){r();if(++n>20)clearInterval(t)},500);r();})();</script>`;

// Append the reporter just before </body> (or at the end if there is none).
export function injectHeightReporter(html: string): string {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${REPORTER}</body>`);
  return html + REPORTER;
}
