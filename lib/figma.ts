export type FigmaRef = { fileKey: string; nodeId: string };

const FIGMA_API = "https://api.figma.com/v1";

// Parse a Figma file/proto/design URL into a file key + node id.
// Handles /proto/, /file/, /design/, /board/ and the node-id `12-34` -> `12:34`
// normalization Figma uses in share/prototype links. Returns null if the URL is
// not a Figma link or has no node id.
export function parseFigmaUrl(input: string): FigmaRef | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)figma\.com$/i.test(u.hostname)) return null;

  const m = u.pathname.match(/\/(?:proto|file|design|board)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  const fileKey = m[1];

  const rawNode = u.searchParams.get("node-id");
  if (!rawNode) return null;
  const nodeId = rawNode.replace(/-/g, ":"); // 12-34 -> 12:34

  return { fileKey, nodeId };
}

// The interactive prototype embed player. `embed_host` is a free analytics label.
export function buildEmbedUrl(originalUrl: string, host = "markitup"): string {
  return `https://www.figma.com/embed?embed_host=${encodeURIComponent(host)}&url=${encodeURIComponent(originalUrl)}`;
}

// Render a single node to a PNG. Returns the (temporary) Figma S3 URL of the image.
export async function figmaRenderPng(
  ref: FigmaRef,
  token: string,
): Promise<{ url: string } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(
      `${FIGMA_API}/images/${ref.fileKey}?ids=${encodeURIComponent(ref.nodeId)}&format=png&scale=2`,
      { headers: { "X-Figma-Token": token } },
    );
  } catch {
    return { error: "Could not reach Figma. Try again." };
  }
  if (res.status === 403) return { error: "Figma rejected the saved token. Reconnect Figma in settings." };
  if (res.status === 404) return { error: "That file isn't accessible with the saved Figma token." };
  if (res.status === 429) return { error: "Figma is rate-limiting requests. Try again shortly." };
  if (!res.ok) return { error: `Figma API error (${res.status}).` };

  const data = (await res.json()) as { images?: Record<string, string | null>; err?: string };
  const url = data.images?.[ref.nodeId];
  if (!url) return { error: "Figma couldn't render that frame. Check the link points to a frame." };
  return { url };
}

// Best-effort human name for the node (used as the mockup name). Null on failure.
export async function figmaNodeName(ref: FigmaRef, token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${FIGMA_API}/files/${ref.fileKey}/nodes?ids=${encodeURIComponent(ref.nodeId)}`,
      { headers: { "X-Figma-Token": token } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      nodes?: Record<string, { document?: { name?: string } }>;
    };
    return data.nodes?.[ref.nodeId]?.document?.name ?? null;
  } catch {
    return null;
  }
}
