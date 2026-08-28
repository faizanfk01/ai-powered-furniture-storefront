import Link from "next/link";
import type { ReactNode } from "react";

import type { ChatProduct } from "@/lib/ai/facts";

import { parseMarkdown, type Block, type Inline } from "./markdown";

/**
 * The assistant's prose, rendered as a restrained subset of markdown, with its
 * citations turned into real links.
 *
 * The backend hands back text carrying `[P1]`-style tags and a separate list
 * of the products those tags refer to — rows, with their own slugs. Resolving
 * one against the other happens here, and it is the last step of the same
 * argument the whole phase is built on: the model never writes a URL, so a
 * link in this panel cannot point anywhere except at a product that came out
 * of the database.
 *
 * MARKDOWN IS DISPLAY ONLY, and the ordering is what makes that safe to say.
 * lib/ai/chat.ts normalises the reply, runs lib/ai/grounding.ts against it,
 * and DISCARDS it for a deterministic one if a citation points outside the
 * retrieved set or a figure appears that no fact block contains. All of that
 * happens on the server, against the raw string, before this component is
 * handed anything. Formatting cannot launder a fabricated price, because by
 * the time there is formatting to apply the price has already been checked.
 *
 * NO HTML IS EVER CONSTRUCTED. components/chat/markdown.ts returns a token
 * tree and the functions below turn tokens into React elements, so every text
 * value goes through React's own escaping. There is no dangerouslySetInnerHTML
 * on this path, which is why there is also no sanitiser: markup in a reply is
 * not sanitised, it is simply never interpreted. A reply containing a script
 * tag renders the characters of a script tag.
 *
 * WHY A FOOTNOTE MARK RATHER THAN LINKING THE NAME. The reply reads "the
 * Karachi 3-Seater Fabric Sofa [P1] is built on a sheesham frame" — the name
 * is already there, in the model's own sentence. Turning the tag into the name
 * again would stutter; finding the name in the prose and linking it in place
 * would mean string-matching model output against a row, which is exactly the
 * kind of guessing this codebase avoids. A numbered mark is honest about what
 * it is: a reference to the card below, in the same accent the rest of the
 * site uses for marks.
 *
 * A tag with no matching product is dropped rather than shown. It should never
 * arrive — lib/ai/grounding.ts rejects any reply citing outside the retrieved
 * set — but if one ever did, a raw "[P9]" in the transcript would be the one
 * piece of visible evidence that the grounding check had failed, and silently
 * dropping it is better than rendering a dead reference to a customer.
 */

export function ChatReply({
  text,
  products,
}: {
  text: string;
  products: ChatProduct[];
}) {
  const byRef = new Map(products.map((product) => [product.ref, product]));
  const blocks = parseMarkdown(text);

  return (
    // `space-y` rather than margins on the children: the first block must not
    // push the bubble open at the top, and the last must not leave a gap at
    // the bottom. Text colour is set once here and inherited.
    <div className="space-y-2 leading-relaxed text-ink">
      {blocks.map((block, index) => (
        <BlockNode key={index} block={block} byRef={byRef} />
      ))}
    </div>
  );
}

type Refs = Map<number, ChatProduct>;

function BlockNode({ block, byRef }: { block: Block; byRef: Refs }) {
  if (block.kind === "heading") {
    // Deliberately not <h3>: a chat bubble is not a document outline, and a
    // real heading level here would land inside the drawer's own <h2> and
    // announce a structure that does not exist. It is a bold lead-in line,
    // which is all the model means by it.
    return (
      <p className="text-sm font-semibold text-ink">
        <InlineNodes nodes={block.children} byRef={byRef} />
      </p>
    );
  }

  if (block.kind === "list") {
    const className =
      "space-y-1 pl-5 " +
      (block.ordered ? "list-decimal" : "list-disc") +
      " marker:text-muted";

    const items = block.items.map((item, index) => (
      <li key={index}>
        <InlineNodes nodes={item} byRef={byRef} />
      </li>
    ));

    return block.ordered ? (
      <ol className={className}>{items}</ol>
    ) : (
      <ul className={className}>{items}</ul>
    );
  }

  return (
    <p>
      <InlineNodes nodes={block.children} byRef={byRef} />
    </p>
  );
}

function InlineNodes({ nodes, byRef }: { nodes: Inline[]; byRef: Refs }) {
  const out: ReactNode[] = [];

  nodes.forEach((node, index) => {
    switch (node.kind) {
      case "text":
        out.push(node.value);
        break;

      case "break":
        out.push(<br key={index} />);
        break;

      case "code":
        out.push(
          <code
            key={index}
            className="rounded bg-ink/[0.06] px-1 py-0.5 text-[0.9em]"
          >
            {node.value}
          </code>,
        );
        break;

      case "strong":
        out.push(
          <strong key={index} className="font-semibold text-ink">
            <InlineNodes nodes={node.children} byRef={byRef} />
          </strong>,
        );
        break;

      case "em":
        out.push(
          <em key={index} className="italic">
            <InlineNodes nodes={node.children} byRef={byRef} />
          </em>,
        );
        break;

      case "citation": {
        const product = byRef.get(node.ref);
        // Dropped, not rendered. See the note at the top of the file.
        if (!product) break;

        out.push(
          <Link
            key={index}
            href={product.href}
            // `align-super` rather than a <sup>: at this size the mark sits
            // correctly on the baseline without the browser's own font-size
            // reduction making it unreadable on a phone.
            //
            // `accent-strong` rather than `brass`: brass is 2.9:1 on white,
            // which is fine for a rule or a tick and not for a number somebody
            // has to read. The darkened accent is 4.6:1 and still
            // unmistakably the same mark colour.
            className="tabular ml-0.5 inline-block align-super text-[0.7em] font-medium text-accent-strong underline decoration-accent-strong/40 underline-offset-2 transition-colors hover:decoration-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            <span className="sr-only">See </span>
            {product.ref}
            <span className="sr-only">. {product.name}</span>
          </Link>,
        );
        break;
      }
    }
  });

  return <>{out}</>;
}
