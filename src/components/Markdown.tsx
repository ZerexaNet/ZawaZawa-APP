import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ breaks: true, gfm: true });

export function Markdown({ content, className = 'md' }: { content?: string; className?: string }) {
  const html = useMemo(() => {
    if (!content) return '';
    const raw = marked.parse(content) as string;
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['style', 'form', 'input'],
    });
  }, [content]);
  if (!html) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
