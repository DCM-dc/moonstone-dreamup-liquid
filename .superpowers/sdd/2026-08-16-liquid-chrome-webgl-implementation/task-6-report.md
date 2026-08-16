# Task 6 Report: DOM Bootstrap and Crisp-Glass Material Integration

Status: complete

## RED evidence

The section-behavior suite was written before `dom-sections.js` existed:

```text
npm test -- tests/dom-sections.test.js
Test Files  1 failed (1)
Tests       no tests
Cannot find module '../enhancement-src/src/dom-sections.js'
```

After section measurement went green, the bootstrap behavior tests failed against the stub `main.js` for the intended missing exports and behavior:

```text
npm test -- tests/dom-sections.test.js
Test Files  1 failed (1)
Tests       9 failed | 4 passed (13)
bootstrapMoonstone / calculateFrameDelta / claimContextRestore are not functions
```

Two additional regression cycles caught concrete fallback defects:

- Capability detection initially let a thrown `matchMedia` escape instead of removing the target canvas and retaining the fallback (`1 failed | 13 passed`).
- A reduced-motion document that started hidden rendered zero frames, and reduced-motion scrolling left the scalar/world state at the bootstrap position (`2 failed | 14 passed`).

The production changes for each cycle were made only after observing these failures.

## GREEN evidence

Fresh focused Task 6 suite:

```text
npm test -- tests/dom-sections.test.js
Test Files  1 passed (1)
Tests       16 passed (16)
```

Fresh full suite:

```text
npm test
Test Files  10 passed (10)
Tests       47 passed (47)
```

Fresh production build:

```text
npm run build
exit code 0
```

Final bundled payload sizes:

```text
dist/liquid-world.js       raw 559314 bytes, gzip 145061 bytes
dist/moonstone-metal.css   raw  17508 bytes, gzip   3459 bytes
```

The JavaScript remains well under the design's 700 KB compressed budget.

## Bootstrap and fallback findings

- `measureSections` returns all eight narrative sections in the approved order, preserves measured tops/heights, clamps collapsed/invalid heights to one pixel, and identifies the first missing selector in its error.
- WebGL2 support is checked on a temporary, detached probe canvas. The behavioral test records one `webgl2` request on the probe and zero `getContext` calls on the target canvas, leaving Three.js authoritative over the tier's antialias/context attributes.
- The body enters `moonstone-enhanced moonstone-webgl-fallback` before probing or world initialization. `moonstone-webgl-ready` is added only by Task 5's valid-frame callback.
- Forced fallback, probe failure, capability failure, section measurement failure, world initialization failure, fatal render failure, and denied session storage all retain usable DOM fallback state. Fatal paths cancel rAF, remove listeners/context bindings, dispose the world defensively, and remove the target canvas.
- Context loss immediately restores the fallback body state and hero image, pauses/cancels rendering, and claims at most one session restore. A successful restore reloads; storage denial or a repeated attempt remains permanent fallback without throwing.
- Fine-pointer parallax is installed only for `(hover: hover) and (pointer: fine)` with reduced motion off. Pointer damping receives actual rAF elapsed time capped at 100 ms; tests cover `0`, `32 ms`, and a capped long gap.
- Reduced motion renders exactly one current-scroll frame without starting rAF or pointer tracking, including when the document starts hidden. Later scroll/load/resize events update scalar/world measurement state without rendering another frame or clearing the static canvas.
- `--ms-scroll`, `--ms-local`, and `--ms-gather` are updated as scalar root properties, with no layout animation tied to them.

## DOM and build preservation

After the behavioral tests and build, `rg` found all mandated hooks in both generated documents:

| Hook | `dist/index.html` | `dist/moonstone-dreamup/index.html` |
| --- | --- | --- |
| `impact-intro` | present | present |
| `hero-image` | present | present |
| `register-overlay` | present | present |
| `register-drawer` | present | present |
| `register-form` | present | present |

Both documents contain exactly the expected injected stylesheet and module paths under `/moonstone-dreamup`. Mirrored payloads are byte-identical:

```text
JavaScript SHA-256 F864C6F52165442AB0D4DA97EC0EC2A9539DA1AC18DE4774D561F6796283DCF4
CSS SHA-256        7CA69DDA6FE14D30EBD90CDBCE92EF276927FFF77DFB76B324E62FF82F0CC8AD
```

No HTML or compiled application chunk was rewritten.

## Local browser smoke

A small, noncommitted smoke run served the rebuilt nested output with `forceWebglFallback` and exercised the real compiled page:

- The existing click-driven intro appeared, completed after activation, and removed its overlay (`display: none`, `visibility: hidden`).
- The inline-proof fallback state kept `.hero-image` visible at opacity `1` after GSAP's `autoAlpha` writes.
- `.intro-flash` remained non-rendering, preventing the original fluorescent blue flash from reappearing while the rest of the intro timeline completed.
- The registration FAB opened the real dialog and form; both were visible, the existing controls remained present, and the close control restored the hidden overlay state.
- Final console error list: `[]`.

Task 8 still owns comprehensive viewport, keyboard, reduced-motion, forced-fallback, and live-WebGL E2E/visual QA.

## Material and motion implementation

- The override establishes black/graphite, platinum/gunmetal, sparse cyan, and warm-orange materials across the existing hero, intro, section, decoration, CTA, footer, and registration selectors.
- Old violet glows, fluorescent section fills, bloom-like shadows, and legacy meteor/join imagery are suppressed or replaced; the outcomes overlay remains translucent enough for the continuous world.
- Real `backdrop-filter` blur is confined to cards and the registration drawer at 12–14 px. Unsupported browsers receive opaque material fallbacks.
- Specular text uses a 7.5-second metallic cycle. UI feedback uses explicit transform/color properties, 140–260 ms durations, approved custom curves, no `transition: all`, no `ease-in`, and fine-pointer-only hover motion.
- Ready state crossfades the fallback photo by opacity while keeping it paintable; fallback/context-loss state restores the photo and hides the canvas without a transition, avoiding a black gap.
- Strong `:focus-visible` rings, responsive drawer sizing, coarse-pointer hover neutralization, and comprehensive reduced-motion overrides preserve usability.

Motion gate: hover/press motion is terse feedback for frequent interactions; the drawer transition provides occasional spatial continuity; the slow specular pass is marketing explanation. No additional decorative entrance choreography was added.

## Files

- `enhancement-src/src/dom-sections.js` — ordered narrative selectors and defensive section measurement.
- `enhancement-src/src/main.js` — testable, fallback-safe bootstrap and scene lifecycle.
- `enhancement-src/styles/moonstone-metal.css` — comprehensive metallic/crisp-glass override and responsive/reduced-motion states.
- `tests/dom-sections.test.js` — section, bootstrap, fallback, pointer, reduced-motion, context-loss, and storage behavior.

## Review and concerns

Independent review found no Critical issues. Its hidden-start reduced-motion finding was fixed with a failing regression test; its overly opaque outcomes finding was fixed by lowering the metallic overlay alpha. The recommendation to restore the legacy blue intro flash was not adopted because the controller explicitly required inline-proof suppression of that fluorescent artifact; browser smoke verified the surrounding intro still completes.

No blocking concerns. Full aesthetic tuning and live-WebGL E2E remain intentionally deferred to Tasks 7–8.

## Commit

This report is included in `feat: integrate liquid world with MoonStone DOM` rather than a separate report commit.
