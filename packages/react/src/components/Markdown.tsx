import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remend from "remend";

export interface MarkdownProps {
  children: string;
  className?: string;
}

const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

const COMPONENTS: Components = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
  // An image whose URL is still being written, or was blocked as unsafe, has
  // an empty src and would show as a broken image.
  img: ({ node, ...props }) => (props.src ? <img {...props} /> : null),
};

export function Markdown({ children, className }: MarkdownProps): JSX.Element {
  return (
    <div className={className ? `rt-markdown ${className}` : "rt-markdown"}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {remend(children, { linkMode: "text-only" })}
      </ReactMarkdown>
    </div>
  );
}
