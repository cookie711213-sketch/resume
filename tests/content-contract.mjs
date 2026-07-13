import { parseHTML } from 'linkedom';

export function parseResumeDocument(source) {
  return parseHTML(source).document;
}

export function getElements(document, selector) {
  const root = document.body ?? document;
  return [...root.querySelectorAll(selector)];
}
