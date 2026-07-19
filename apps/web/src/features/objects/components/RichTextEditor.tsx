import { useEffect, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { Block, PartialBlock } from '@blocknote/core';
import '@blocknote/mantine/style.css';

export interface RichTextValue {
  blocknote?: unknown;
  markdown?: string | null;
}

/**
 * BlockNote rich-text editor for RICH_TEXT fields (task/note bodies).
 * Persists the block JSON under `blocknote` plus a lossy `markdown` rendering (mirrors our
 * RICH_TEXT column mapping: `<name>_blocknote jsonb` + `<name>_markdown text`).
 */
export function RichTextEditor({
  value,
  onChange,
  editable = true,
}: {
  value: RichTextValue | null | undefined;
  onChange: (value: RichTextValue) => void;
  editable?: boolean;
}) {
  const initialContent =
    Array.isArray(value?.blocknote) && value.blocknote.length > 0
      ? (value.blocknote as PartialBlock[])
      : undefined;

  const editor = useCreateBlockNote({ initialContent });
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  async function handleChange(): Promise<void> {
    const document = editor.document as Block[];
    const markdown = await editor.blocksToMarkdownLossy(document);
    onChange({ blocknote: document, markdown: markdown || null });
  }

  return (
    <div className="rounded-md border">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={isDark ? 'dark' : 'light'}
        onChange={() => void handleChange()}
      />
    </div>
  );
}
