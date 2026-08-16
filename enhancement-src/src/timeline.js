const clamp = value => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

export function createScrollModel(sections) {
  const ordered = sections.map(section => ({ ...section, end: section.top + section.height }));
  const end = Math.max(1, ...ordered.map(section => section.end));
  return { sections: ordered, end };
}

export function sampleScroll(model, y) {
  const position = Number.isFinite(y) ? y : 0;
  const page = clamp(position / model.end);
  const active = model.sections.find(section => position < section.end) ?? model.sections.at(-1);
  const local = clamp((position - active.top) / active.height);
  const joinIndex = model.sections.findIndex(section => section.id === 'join');
  const joinStart = joinIndex >= 0 ? model.sections[joinIndex].top : model.end * 0.8;

  return {
    activeId: active.id,
    local,
    page,
    intro: clamp(1 - page * 7),
    gather: clamp((position - joinStart) / Math.max(1, model.end - joinStart))
  };
}
