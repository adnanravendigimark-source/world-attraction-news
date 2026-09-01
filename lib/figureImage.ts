import { Node, mergeAttributes } from "@tiptap/core";

// A captioned, aligned image node — renders as
// <figure class="img-align-{left|center|right|full}"><img .../><figcaption>...</figcaption></figure>
// Deliberately its own Node (not TiptapImage's default schema) because
// TiptapImage alone has no caption/alignment attributes and no way to
// render the <figure> wrapper those need. Every image still only ever
// enters the document via an actual file upload (see the drag-drop /
// file-input handlers in RichTextEditor.tsx) — there is no attribute or
// toolbar action here that accepts a pasted external image URL.
export interface FigureImageOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figureImage: {
      setFigureImage: (options: { src: string; alt?: string; caption?: string; align?: string }) => ReturnType;
      updateFigureImage: (options: { caption?: string; align?: string }) => ReturnType;
    };
  }
}

export const FigureImage = Node.create<FigureImageOptions>({
  name: "image",
  group: "block",
  draggable: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
      align: { default: "center" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-figure-image]",
        getAttrs: (el) => {
          const figure = el as HTMLElement;
          const img = figure.querySelector("img");
          const figcaption = figure.querySelector("figcaption");
          return {
            src: img?.getAttribute("src") || "",
            alt: img?.getAttribute("alt") || "",
            caption: figcaption?.textContent || "",
            align: figure.getAttribute("data-align") || "center",
          };
        },
      },
      { tag: "img[src]", getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute("src"), alt: (el as HTMLElement).getAttribute("alt") || "" }) },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { src, alt, caption, align } = node.attrs;
    return [
      "figure",
      mergeAttributes(this.options.HTMLAttributes, { "data-figure-image": "", "data-align": align, class: `img-align-${align}` }),
      ["img", { src, alt }],
      ...(caption ? [["figcaption", {}, caption] as any] : []),
    ];
  },

  addCommands() {
    return {
      setFigureImage:
        (options) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { src: options.src, alt: options.alt || "", caption: options.caption || "", align: options.align || "center" },
          }),
      updateFigureImage:
        (options) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, options),
    };
  },
});

export default FigureImage;
