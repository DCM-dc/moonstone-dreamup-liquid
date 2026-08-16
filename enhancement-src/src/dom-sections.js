export const SECTION_TARGETS = Object.freeze([
  ['top', '#top'],
  ['manifesto', '#manifesto'],
  ['format', '#format'],
  ['who', '.who'],
  ['outcomes', '.outcomes'],
  ['proof', '#proof'],
  ['faq', '.faq'],
  ['join', '#join']
]);

function safeHeight(value) {
  return Number.isFinite(value) ? Math.max(1, value) : 1;
}

export function measureSections(documentLike) {
  return SECTION_TARGETS.map(([id, selector]) => {
    const node = documentLike.querySelector(selector);
    if (!node) throw new Error(`Missing MoonStone section: ${selector}`);

    return {
      id,
      top: node.offsetTop,
      height: safeHeight(node.offsetHeight)
    };
  });
}
