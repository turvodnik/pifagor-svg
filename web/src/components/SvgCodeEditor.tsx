import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { xml } from "@codemirror/lang-xml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";

interface SvgCodeEditorProps {
  id?: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
}

const svgHighlightStyle = HighlightStyle.define([
  { tag: tags.angleBracket, color: "#c792ea" },
  { tag: tags.tagName, color: "#c792ea" },
  { tag: tags.attributeName, color: "#dde6f2" },
  { tag: tags.attributeValue, color: "#7fcb9a" },
  { tag: tags.string, color: "#7fcb9a" },
  { tag: tags.number, color: "#dfe8ef" },
  { tag: tags.comment, color: "#cc7a33", fontStyle: "italic" },
  { tag: tags.definition(tags.tagName), color: "#c792ea" },
  { tag: tags.processingInstruction, color: "#9aa9bb" },
  { tag: tags.invalid, color: "#ff7a90" }
]);

export function SvgCodeEditor({ id, ariaLabel, value, onChange }: SvgCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) {
      return undefined;
    }

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          xml(),
          syntaxHighlighting(svgHighlightStyle, { fallback: true }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !isSyncingRef.current) {
              onChangeRef.current(update.state.doc.toString());
            }
          })
        ]
      })
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === value) {
      return;
    }
    isSyncingRef.current = true;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value }
    });
    isSyncingRef.current = false;
  }, [value]);

  return (
    <div className="svg-code-editor">
      <div ref={hostRef} />
      <textarea
        id={id}
        className="code-editor-proxy"
        aria-label={ariaLabel}
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
