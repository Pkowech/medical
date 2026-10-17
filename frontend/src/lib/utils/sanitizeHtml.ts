import createDOMPurify from 'dompurify';

const ALLOWED_HTML_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 'mark',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'span', 'div',
];

const ALLOWED_HTML_ATTRS = ['href', 'target', 'rel', 'class', 'title'];

export function sanitizeHtml(value: string): string {
  if (!value) return '';

  if (typeof window === 'undefined') {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/<(?!(?:\/?(?:p|br|strong|b|em|i|u|ul|ol|li|h[1-6]|blockquote|code|pre|mark|table|thead|tbody|tr|th|td|a|span|div))\b)[^>]*>/gi, '');
  }

  const purifier = createDOMPurify(window);
  return purifier.sanitize(value, {
    ALLOWED_TAGS: ALLOWED_HTML_TAGS,
    ALLOWED_ATTR: ALLOWED_HTML_ATTRS,
    ADD_ATTR: ['target'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });
}
