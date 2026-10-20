import { memo } from "react";
import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
  type UrlTransform,
} from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remend from "remend";

export interface MarkdownProps {
  children: string;
  className?: string;
}

const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

const PHONE_LINK = /^(tel|sms):/i;

const urlTransform: UrlTransform = (url, key) =>
  key === "href" && PHONE_LINK.test(url) ? url : defaultUrlTransform(url);

const COMPONENTS: Components = {
  a: ({ node, ...props }) =>
    props.href && PHONE_LINK.test(props.href) ? (
      <a {...props} />
    ) : (
      <a {...props} target="_blank" rel="noreferrer" />
    ),
  img: ({ node, ...props }) => (props.src ? <img {...props} /> : null),
};

export const Markdown = memo(function Markdown({
  children,
  className,
}: MarkdownProps): JSX.Element {
  return (
    <div className={className ? `rt-markdown ${className}` : "rt-markdown"}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={COMPONENTS}
        urlTransform={urlTransform}
      >
        {remend(children, { linkMode: "text-only" })}
      </ReactMarkdown>
    </div>
  );
});
