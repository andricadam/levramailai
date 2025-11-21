import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Editor } from "@tiptap/react";
import {
    Type,
    Code,
    Hash,
    Italic,
    List,
    ListOrdered,
    Quote,
    Redo,
    Minus,
    Undo,
} from "lucide-react";

const TipTapMenuBar = ({ editor }: { editor: Editor }) => {
    return (
        <div className="flex flex-wrap gap-2 p-2 border-b">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("bold") ? "is-active" : ""}`}
            >
                <Type className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("italic") ? "is-active" : ""}`}
            >
                <Italic className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                disabled={!editor.can().chain().focus().toggleStrike().run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("strike") ? "is-active" : ""}`}
            >
                <Minus className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                disabled={!editor.can().chain().focus().toggleCode().run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("code") ? "is-active" : ""}`}
            >
                <Code className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("heading", { level: 1 }) ? "is-active" : ""}`}
            >
                <Hash className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
            >
                <Hash className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("heading", { level: 3 }) ? "is-active" : ""}`}
            >
                <Hash className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("heading", { level: 4 }) ? "is-active" : ""}`}
            >
                <Hash className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("heading", { level: 5 }) ? "is-active" : ""}`}
            >
                <Hash className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("heading", { level: 6 }) ? "is-active" : ""}`}
            >
                <Hash className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("bulletList") ? "is-active" : ""}`}
            >
                <List className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("orderedList") ? "is-active" : ""}`}
            >
                <ListOrdered className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1 rounded hover:bg-accent ${editor.isActive("blockquote") ? "is-active" : ""}`}
            >
                <Quote className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                className="p-1 rounded hover:bg-accent disabled:opacity-50"
            >
                <Undo className="size-4 text-secondary-foreground" />
            </button>
            <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                className="p-1 rounded hover:bg-accent disabled:opacity-50"
            >
                <Redo className="size-4 text-secondary-foreground" />
            </button>
        </div>
    );
};

export default TipTapMenuBar;