import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Node, mergeAttributes } from "@tiptap/core";
import { Bold, Underline as UnderlineIcon, List as ListIcon, Quote, FlaskConical, Code2 } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";

const ScienceBox = Node.create({
  name: "scienceBox",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div.science-box" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ class: "science-box" }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleScienceBox:
        () =>
        ({ commands }: any) => {
          return commands.toggleWrap(this.name);
        },
    } as any;
  },
});

const Ornament = Node.create({
  name: "ornament",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "div.ornament" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ class: "ornament" }, HTMLAttributes), "· · ·"];
  },
});

interface Props {
  value: string;
  onChange: (html: string) => void;
}

export default function RichTextEditor({ value, onChange }: Props) {
  const [mode, setMode] = useState<"rich" | "html">("rich");
  const [htmlDraft, setHtmlDraft] = useState(value);

  const editor = useEditor({
    extensions: [StarterKit, Underline, ScienceBox, Ornament],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (mode === "rich" && editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor, mode]);

  if (!editor) return null;

  const switchToHtml = () => {
    setHtmlDraft(editor.getHTML());
    setMode("html");
  };

  const switchToRich = () => {
    editor.commands.setContent(htmlDraft);
    onChange(htmlDraft);
    setMode("rich");
  };

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <Toggle
          size="sm"
          disabled={mode === "html"}
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          disabled={mode === "html"}
          pressed={editor.isActive("underline")}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          disabled={mode === "html"}
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <ListIcon className="h-4 w-4" />
        </Toggle>

        <div className="mx-1 h-4 w-px self-center bg-border" />

        <Toggle
          size="sm"
          disabled={mode === "html"}
          pressed={editor.isActive("blockquote")}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Pull quote"
          title="Pull Quote"
        >
          <Quote className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          disabled={mode === "html"}
          pressed={editor.isActive("scienceBox")}
          onPressedChange={() => (editor.chain().focus() as any).toggleScienceBox().run()}
          aria-label="Research box"
          title="Research Box"
        >
          <FlaskConical className="h-4 w-4" />
        </Toggle>

        <div className="ml-auto flex items-center gap-2">
          {mode === "html" && (
            <span className="hidden sm:inline text-[11px] text-muted-foreground">
              Switching back to Rich may strip unsupported tags.
            </span>
          )}
          <Toggle
            size="sm"
            pressed={mode === "html"}
            onPressedChange={(pressed) => (pressed ? switchToHtml() : switchToRich())}
            aria-label="Edit HTML source"
            title="Edit HTML source"
          >
            <Code2 className="h-4 w-4" />
            <span className="ml-1 text-xs font-medium">HTML</span>
          </Toggle>
        </div>
      </div>
      {mode === "rich" ? (
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none px-3 py-2 text-sm min-h-[80px] focus-within:outline-none [&_.tiptap]:min-h-[60px] [&_.tiptap]:outline-none [&_.tiptap_p]:my-2 [&_.tiptap_ul]:my-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_li]:my-1 [&_.tiptap_blockquote]:border-l-0 [&_.tiptap_blockquote]:border-t-2 [&_.tiptap_blockquote]:border-b-2 [&_.tiptap_blockquote]:border-primary [&_.tiptap_blockquote]:py-3 [&_.tiptap_blockquote]:my-3 [&_.tiptap_blockquote]:text-center [&_.tiptap_blockquote]:italic [&_.tiptap_blockquote]:px-2 [&_.tiptap_.science-box]:bg-muted [&_.tiptap_.science-box]:border [&_.tiptap_.science-box]:border-border [&_.tiptap_.science-box]:rounded-md [&_.tiptap_.science-box]:p-3 [&_.tiptap_.science-box]:my-2 [&_.tiptap_.ornament]:text-center [&_.tiptap_.ornament]:text-muted-foreground [&_.tiptap_.ornament]:my-4 [&_.tiptap_.ornament]:tracking-[0.5em]"
        />
      ) : (
        <Textarea
          value={htmlDraft}
          onChange={(e) => {
            setHtmlDraft(e.target.value);
            onChange(e.target.value);
          }}
          spellCheck={false}
          className="min-h-[400px] rounded-none border-0 font-mono text-xs leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="<p>Paste raw HTML here. Supported classes: div.ornament, div.science-box, blockquote, h2, h3, ul. Product embeds: <p>[product-embed: uuid]</p></p>"
        />
      )}
    </div>
  );
}
