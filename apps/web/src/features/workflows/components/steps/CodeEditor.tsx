import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';

/**
 * `new Function` compiles the body without executing it, so this is a syntax-only check — good
 * enough to catch typos (unmatched braces, stray commas) without needing a full JS/TS type-checker
 * in the browser. Runtime errors still only surface via the "Test" tab's real execution.
 */
function syntaxCheckLinter() {
  return linter((view): Diagnostic[] => {
    const code = view.state.doc.toString();
    if (!code.trim()) return [];
    try {
      new Function(code);
      return [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Syntax error';
      return [{ from: 0, to: code.length, severity: 'error', message }];
    }
  });
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

/** A JS code field with line numbers, syntax highlighting, and inline syntax-error diagnostics. */
export function CodeEditor({ value, onChange, placeholder, minHeight = '14rem' }: Props) {
  return (
    <div className="overflow-hidden rounded-md border text-xs [&_.cm-editor]:outline-none">
      <CodeMirror
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={minHeight}
        extensions={[javascript(), syntaxCheckLinter(), lintGutter(), EditorView.lineWrapping]}
        basicSetup={{ foldGutter: false }}
      />
    </div>
  );
}
