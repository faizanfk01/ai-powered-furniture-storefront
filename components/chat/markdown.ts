/**
 * A deliberately small markdown parser for assistant replies.
 *
 * It produces a TOKEN TREE, never a string of HTML. That is the whole security
 * argument and it is worth stating plainly: components/chat/chat-reply.tsx
 * turns these nodes into React elements, React escapes every text value it
 * renders, and nothing anywhere in this path calls dangerouslySetInnerHTML. So
 * a reply containing `<script>alert(1)</script>` is rendered as those exact
 * characters on screen. There is no sanitiser to configure and no sanitiser to
 * get wrong, because there is no point at which markup could be interpreted.
 *
 * WHY NOT react-markdown. It is the obvious choice and it was the first one.
 * Three things argued against it here:
 *
 *   1. The citation tags have to interleave with inline formatting. `[P1]`
 *      is markdown link syntax as far as a real parser is concerned, and
 *      **Karachi Sofa [P1]** has to come out as one bold run containing a
 *      footnote link. That is custom work against remark's AST either way, so
 *      the library saves less than it looks like it would.
 *   2. ChatConversation is mounted in app/(storefront)/layout.tsx, so it is in
 *      the client bundle of every page on the site. remark + micromark +
 *      mdast is a large thing to put in front of a customer in Mardan on
 *      mobile data for four constructs. That is the same reasoning
 *      lib/catalog-filters.ts gives for filtering in Postgres.
 *   3. A general parser renders things this panel must not render — images,
 *      raw HTML behind rehype-raw, autolinked URLs. Every one of those would
 *      then need switching off. Starting from nothing and adding four
 *      constructs is a smaller and more auditable surface than starting from
 *      everything and subtracting.
 *
 * WHAT IS SUPPORTED, and nothing else:
 *
 *   **bold**  __bold__  *italic*  _italic_  `code`
 *   - bullet lists (also * and +)      1. numbered lists (also 1) )
 *   # headings (rendered small, see the renderer)
 *   single newline = line break, blank line = new block
 *   [P1] citation tags, resolved against retrieved rows by the renderer
 *
 * WHAT IS DELIBERATELY NOT SUPPORTED:
 *
 *   RAW HTML — never parsed, so it renders as literal text.
 *   IMAGES — `![alt](src)` renders as its alt text. The model has no way to
 *     know a real image URL, so any src it wrote would be invented, and a
 *     broken image in a chat bubble is worse than nothing.
 *   LINKS — `[label](url)` renders as its LABEL, with the url discarded, and
 *     a bare http:// in prose is never turned into a link. Rule 5 of the
 *     answer prompt forbids the model from writing a URL at all: the site
 *     composes links from database rows. A link the model wrote is by
 *     definition a destination nothing verified, which is a phishing vector
 *     dressed as a formatting feature. The citation footnote is the only link
 *     this panel produces, and its href comes from a row.
 *   TABLES, blockquote borders, thematic rules, task lists, footnotes.
 *
 * FORMATTING IS DISPLAY ONLY. lib/ai/grounding.ts has already run against the
 * raw reply text on the server before any of this executes. Nothing here can
 * make an ungrounded reply grounded or the reverse — it can only change how an
 * already-checked string looks. The markdown-aware folding that keeps that
 * check honest lives in grounding.ts, not here.
 */

export type Inline =
  | { kind: "text"; value: string }
  /** A single newline inside one paragraph. */
  | { kind: "break" }
  | { kind: "code"; value: string }
  /** `[P1]`. The renderer resolves the ref against the retrieved products. */
  | { kind: "citation"; ref: number }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] };

export type Block =
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "heading"; children: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

type Found = { index: number; length: number; node: Inline };

/**
 * Inline constructs, in the order they are tried when two of them match at the
 * SAME index. The order is load-bearing in two places:
 *
 *   - `code` first, so backticks win over anything inside them.
 *   - `citation` before `link`, because `[P1]` is a valid markdown shortcut
 *     link and would otherwise be swallowed by link syntax and lost.
 *   - the doubled emphasis markers before the single ones, so `**x**` is bold
 *     rather than an empty italic wrapped around one more star.
 */
const CODE = /`([^`\n]+)`/;
const CITATION = /\[P(\d+)\]/;
const IMAGE = /!\[([^\]\n]*)\]\([^)\n]*\)/;
const LINK = /\[([^\]\n]+)\]\([^)\n]*\)/;
const STRONG_STAR = /\*\*([\s\S]+?)\*\*/;
const STRONG_UNDERSCORE = /__([\s\S]+?)__/;
const EM_STAR = /\*([^*\n]+?)\*/;
const BREAK = /\n/;

/** Guards against a pathological reply spinning the loop below. */
const MAX_INLINE_TOKENS = 4000;

function textNode(value: string): Inline {
  return { kind: "text", value };
}

/** Adjacent text is merged so the renderer emits one span, not a stutter. */
function pushText(out: Inline[], value: string) {
  if (value === "") return;
  const last = out[out.length - 1];
  if (last?.kind === "text") last.value += value;
  else out.push(textNode(value));
}

/**
 * `_italic_`, matched by hand rather than by regex.
 *
 * A regex for this wants a lookbehind to avoid firing inside snake_case, and
 * lookbehind is the one regex feature old Safari does not have — a SyntaxError
 * at module-evaluation time would take the whole chat panel down rather than
 * degrade one italic. Checking the neighbouring character in code costs six
 * lines and works everywhere.
 */
function findUnderscoreEm(text: string): Found | null {
  const wordChar = /[A-Za-z0-9]/;

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "_") continue;
    // Inside a word: snake_case_identifier, not emphasis.
    if (i > 0 && wordChar.test(text[i - 1]!)) continue;
    // `__bold__` is a different construct, handled above this one.
    if (text[i + 1] === "_") continue;

    const close = text.indexOf("_", i + 1);
    if (close === -1) return null;

    const inner = text.slice(i + 1, close);
    if (inner === "" || inner.includes("\n")) continue;

    const after = text[close + 1];
    if (after !== undefined && wordChar.test(after)) continue;

    return {
      index: i,
      length: close + 1 - i,
      node: { kind: "em", children: parseInline(inner) },
    };
  }

  return null;
}

function findFirst(text: string): Found | null {
  const candidates: (Found | null)[] = [];

  const tryPattern = (
    pattern: RegExp,
    build: (match: RegExpExecArray) => Inline,
  ) => {
    const match = pattern.exec(text);
    candidates.push(
      match
        ? { index: match.index, length: match[0].length, node: build(match) }
        : null,
    );
  };

  tryPattern(CODE, (m) => ({ kind: "code", value: m[1]! }));
  tryPattern(CITATION, (m) => ({ kind: "citation", ref: Number(m[1]) }));
  // The url is read and thrown away, for both of these. See the header note.
  tryPattern(IMAGE, (m) => textNode(m[1] ?? ""));
  tryPattern(LINK, (m) => linkAsText(m[1]!));
  tryPattern(STRONG_STAR, (m) => ({ kind: "strong", children: parseInline(m[1]!) }));
  tryPattern(STRONG_UNDERSCORE, (m) => ({ kind: "strong", children: parseInline(m[1]!) }));
  tryPattern(EM_STAR, (m) => ({ kind: "em", children: parseInline(m[1]!) }));
  candidates.push(findUnderscoreEm(text));
  tryPattern(BREAK, () => ({ kind: "break" }));

  let best: Found | null = null;
  for (const candidate of candidates) {
    if (candidate && (best === null || candidate.index < best.index)) {
      best = candidate;
    }
  }

  return best;
}

/**
 * A `[label](url)` collapsed to its label.
 *
 * Returned as an `em`-less wrapper so the label keeps any formatting inside it
 * while the destination disappears entirely.
 */
function linkAsText(label: string): Inline {
  const children = parseInline(label);
  // One plain text child is by far the common case; unwrap it so the DOM does
  // not gain a <strong> that nothing asked for.
  if (children.length === 1 && children[0]!.kind === "text") return children[0]!;
  return { kind: "em", children };
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  let guard = 0;

  while (rest.length > 0) {
    if (guard++ > MAX_INLINE_TOKENS) {
      pushText(out, rest);
      break;
    }

    const found = findFirst(rest);
    if (!found) {
      pushText(out, rest);
      break;
    }

    if (found.index > 0) pushText(out, rest.slice(0, found.index));

    // A zero-length match would loop forever. Nothing above can produce one,
    // and this is here so that stays true if something is added later.
    const consumed = Math.max(found.length, 1);
    if (found.node.kind === "text") pushText(out, found.node.value);
    else out.push(found.node);

    rest = rest.slice(found.index + consumed);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^ {0,3}(?:([-*+])|(\d{1,3})[.)])\s+(.*)$/;
const THEMATIC = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const FENCE = /^ {0,3}(?:```|~~~)/;
const BLOCKQUOTE = /^ {0,3}> ?/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fenced: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    blocks.push({
      kind: "list",
      ordered: list.ordered,
      items: list.items.map((item) => parseInline(item)),
    });
    list = null;
  }

  function flush() {
    flushList();
    flushParagraph();
  }

  /**
   * Fenced content is emitted as a paragraph of LITERAL text — inline parsing
   * is skipped inside it, so `**` between fences stays as typed. The panel has
   * no business rendering a code block (rule 7 of the answer prompt keeps the
   * assistant off code entirely), but if one arrives it should look like the
   * misfire it is rather than be silently reformatted.
   */
  function flushFence() {
    if (!fenced) return;
    const value = fenced.join("\n").trim();
    if (value !== "") blocks.push({ kind: "paragraph", children: [textNode(value)] });
    fenced = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (FENCE.test(trimmed)) {
      if (fenced) flushFence();
      else {
        flush();
        fenced = [];
      }
      continue;
    }

    if (fenced) {
      fenced.push(raw);
      continue;
    }

    if (trimmed === "") {
      flush();
      continue;
    }

    // A horizontal rule carries no information in a chat bubble, and drawing
    // one across a 26rem panel makes the reply look like two replies.
    if (THEMATIC.test(trimmed)) {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", children: parseInline(heading[2]!.trim()) });
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = item[2] !== undefined;
      flushParagraph();
      // A bullet list running straight into a numbered one is two lists.
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(item[3]!);
      continue;
    }

    flushList();
    paragraph.push(line.replace(BLOCKQUOTE, ""));
  }

  flushFence();
  flush();

  return blocks;
}
