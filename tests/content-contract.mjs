import { parseHTML } from 'linkedom';

const NON_RENDERED_TAGS = new Set([
  'HEAD',
  'NOSCRIPT',
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
]);

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BODY',
  'DIV',
  'DL',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
]);

function isHiddenElement(element) {
  if (NON_RENDERED_TAGS.has(element.tagName)) return true;
  if (element.hasAttribute('hidden')) return true;
  if (element.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true') return true;

  const style = element.getAttribute('style') ?? '';
  return /\bdisplay\s*:\s*none\b/i.test(style)
    || /\bvisibility\s*:\s*(?:hidden|collapse)\b/i.test(style)
    || /\bcontent-visibility\s*:\s*hidden\b/i.test(style);
}

export function parseResumeDocument(source) {
  return parseHTML(source).document;
}

export function isRenderedElement(element) {
  for (let current = element; current; current = current.parentElement) {
    if (isHiddenElement(current)) return false;
  }
  return true;
}

export function getVisibleElements(document, selector) {
  const root = document.body ?? document;
  return [...root.querySelectorAll(selector)].filter(isRenderedElement);
}

function renderedText(node) {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return '';
  if (node.nodeType === 1 && isHiddenElement(node)) return '';
  if (node.nodeType === 1 && node.tagName === 'BR') return ' ';

  const content = [...node.childNodes].map(renderedText).join('');
  return node.nodeType === 1 && BLOCK_TAGS.has(node.tagName) ? ` ${content} ` : content;
}

export function getVisibleText(documentOrElement) {
  const root = documentOrElement.body ?? documentOrElement;
  return renderedText(root).replace(/\s+/g, ' ').trim();
}
