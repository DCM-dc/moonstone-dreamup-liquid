# MoonStone DreamUP Liquid Chrome WebGL Redesign

Date: 2026-08-16

## Context

The current MoonStone DreamUP Shanghai site is a static export published through GitHub Pages. Its visual language relies on blue-violet and orange glow, radial gradients, and several photoreal lunar images. The redesign must replace the fluorescent effect with a more individual liquid-metal identity, add restrained Gaussian blur, and expand the photoreal MoonStone visual system without damaging the existing content, registration flow, or static deployment model.

## Goals

- Establish liquid chrome as the primary brand material.
- Make the liquid quality physically legible through reflection, surface tension, merging, and separation rather than glow.
- Build an expandable “gravity archipelago” of a hero moonstone, rock fragments, satellites, and mercury-like droplets.
- Keep text, forms, links, and SEO content in the DOM.
- Preserve the current information architecture and registration behavior.
- Maintain a crisp interface by limiting Gaussian blur to glass panels, small light halos, and selected foreground layers.
- Deliver a static GitHub Pages-compatible build with adaptive quality and a complete non-WebGL fallback.

## Non-goals

- Rewriting the event copy or changing the registration data flow.
- Turning the experience into a game or taking over native page scrolling.
- Using jewelry-like pearlescent moonstone imagery.
- Applying persistent neon bloom or indiscriminate full-page blur.
- Requiring a server-side runtime.

## Approved Visual Direction

The selected direction is:

- Material: liquid chrome.
- Motion density: balanced fluid.
- Hero composition: gravity archipelago.
- Blur language: crisp glass.
- Rendering approach: realtime WebGL.

The palette uses obsidian black, platinum, gunmetal, and cold cyan reflections. Existing violet and orange survive only as small environmental reflections and action accents. Large colored outer glows are removed.

## Architecture

The page remains a DOM-first static site. A single fixed, full-viewport WebGL canvas sits behind the content and renders one continuous world throughout the scroll. One renderer, scene, camera, and animation loop are shared by all sections. A scene controller maps normalized scroll progress to camera position, object transforms, material uniforms, and composition states. Pointer input feeds damped targets for small parallax and droplet attraction. A quality manager controls resolution, geometry detail, reflection updates, and particle count.

The enhancement is isolated from the existing compiled site:

- `enhancement-src/` contains readable WebGL, interaction, fallback, and style source.
- A deterministic build step bundles the enhancement into the unpacked static export.
- The deployment workflow unpacks the existing static archive, builds and injects the enhancement, then publishes the resulting directory.
- The existing registration and intro code is preserved unless a compatibility fix is required.

The canvas never captures link, button, form, or scroll events. WebGL failure cannot make the content unavailable.

## WebGL Scene System

### Moonstone Geometry

The hero moonstone and fragments use cratered, irregular rock geometry. The base form is generated from subdivided icosahedra with deterministic fractal displacement and analytic crater deformation. The same generator produces eight unique fragment silhouettes and three levels of detail. Rock shading uses triplanar procedural noise, crater normals, roughness variation, and fine lunar dust.

### Liquid Chrome Film

A slightly offset shell covers selected regions of the rock. Its fragment shader blends a moving coverage mask, noise-derived normal distortion, Fresnel reflection, and environment lighting. The mask flows slowly into cracks and crater edges. The material is fully metallic with low but nonzero roughness so highlights stretch rather than appear as white glow.

### Liquid Droplets

The most visible droplets use a signed-distance-field material rendered inside proxy volumes. Smooth-min blending lets nearby droplets visually merge and separate with surface tension. Smaller distant droplets use instanced meshes to keep the cost bounded. Pointer movement changes attraction targets only within a small radius; scroll drives the main choreography.

### Lighting and Reflection

The scene uses a dark procedural environment with narrow cool and warm light cards. Desktop high quality updates a 256 px cube reflection every sixth rendered frame. Medium and low quality use a prefiltered static environment. Tone mapping preserves metal contrast without bloom. No depth-of-field post-process is required for the approved crisp-glass direction.

## Scroll Narrative

1. Intro: a mercury drop impacts the dark field and creates a mirrored distortion ring.
2. Hero: the main cratered moonstone, eight fragments, and chrome droplets form the high-tier gravity archipelago; adaptive tiers reduce only the fragment count.
3. Manifesto: the cluster separates; individual fragments frame the heading and value cards.
4. Format and audience: fragments follow a restrained orbital path while the content remains dominant.
5. Outcomes and proof: the orbit accelerates slightly and the fragments begin to converge.
6. FAQ: motion density drops substantially to prioritize reading.
7. Final call to action: the archipelago recombines into a complete lunar core behind the registration action.

Native scrolling remains untouched. The canvas composition changes continuously rather than creating a separate renderer for every section.

## DOM Material System

- Replace blue-violet glow shadows with moving chrome specular lines and metallic gradients.
- Use 12–14 px `backdrop-filter` blur on selected cards and overlays only.
- Preserve sharp typography, imagery, and primary controls.
- Restyle the light audience section as a moon-white brushed-metal plate with dark graphite text.
- Use thin platinum borders, restrained inner highlights, and low-opacity grain for tactile depth.
- Keep orange only for high-priority actions and small orientation cues.
- Avoid rounded glass everywhere; glass is reserved for interactive or layered content.

## Photoreal Asset Family

The redesign adds a consistent family of supporting raster assets:

- One hero fallback image matching the gravity-archipelago WebGL composition.
- Three section decoration images showing a single fragment, a small fragment cluster, and a macro lunar surface with liquid chrome in its craters.
- One updated social sharing image.
- Transparent WebP decoration exports plus dark-background fallbacks for browsers that cannot composite them correctly.

All images use the same directional lighting, crater scale, rock color, chrome response, and black environment. They depict lunar geology rather than polished jewelry. Existing hero and meteor images are removed from visible compositions; their original files remain unreferenced inside the source archive for rollback.

## Interaction and Motion

- The intro lasts approximately three to four seconds and is immediately skippable.
- Idle liquid deformation uses slow six-to-ten-second cycles.
- Pointer parallax is capped near three degrees.
- Buttons and cards respond within roughly 180–260 ms.
- Page visibility pauses the renderer when the tab is hidden.
- `prefers-reduced-motion` disables orbit choreography, pointer attraction, and liquid morphing while retaining a static metallic composition.
- The WebGL canvas uses `pointer-events: none`; a separate passive input listener observes pointer position.

## Adaptive Quality and Failure Handling

Three quality tiers are selected from WebGL capability, viewport, device hints, and measured frame time:

- High: full hero geometry, eight fragments, three SDF droplet groups, sixth-frame dynamic reflection, and device pixel ratio capped at 1.5.
- Medium: second-level geometry, six fragments, one SDF droplet group, static prefiltered environment, and device pixel ratio capped at 1.25.
- Low/mobile: third-level hero geometry, four fragments, instanced droplets only, simplified chrome shader, no dynamic reflection, and device pixel ratio capped at 1.0.

The page renders the fallback hero image before WebGL initializes. The canvas fades in only after the first valid frame. Shader compilation failure, unsupported WebGL, or failed asset initialization leaves the fallback in place. A lost WebGL context is restored once; repeated failure permanently returns to the fallback for that session.

## Accessibility

- All meaningful copy and controls remain semantic DOM content.
- Canvas content is decorative and hidden from assistive technology.
- Keyboard focus order and visible focus styles remain intact.
- Text and controls meet WCAG AA contrast against every section state.
- Reduced-motion mode is complete rather than a slower version of the animation.
- The intro skip control is keyboard accessible and visible on focus.

## Performance Budget

- Target 55–60 frames per second on typical desktop hardware and at least 30 frames per second on ordinary mobile hardware.
- Cap renderer pixel ratio by quality tier rather than using the device ratio unbounded.
- Load the fallback image eagerly; load WebGL code and noncritical section imagery without blocking DOM content.
- Keep the compressed enhancement JavaScript below 700 KB and the eager fallback image below 500 KB.
- Compress models, textures, and raster assets; avoid loading desktop-only detail on mobile.
- Pause rendering when hidden and reduce work when the canvas is visually occluded by the registration drawer.
- Keep one renderer and reuse geometry, materials, render targets, and typed arrays.

## Page Mapping

| Region | WebGL composition | DOM treatment |
| --- | --- | --- |
| Intro | Mercury impact and mirror ripple | Chrome word transition |
| Hero | Main stone, fragments, liquid droplets | Mirror title and crisp CTA |
| Manifesto and format | Separating fragments and orbital line | 12–14 px glass cards |
| Audience | Single suspended droplet | Moon-white brushed metal |
| Outcomes and proof | Accelerating convergence | Metallic data and reflection lines |
| FAQ | Distant, nearly static orbit | Reading-first surface |
| Final CTA | Recombined lunar core | Liquid chrome registration action |

## Verification and Acceptance Criteria

- The enhanced build deploys as static files through GitHub Pages.
- First content appears with the fallback image before WebGL and transitions without a blank frame.
- The site remains fully usable with WebGL disabled, JavaScript failure in the enhancement, reduced motion, or a lost context.
- Registration drawer, form submission, anchors, intro skip, keyboard navigation, and focus management continue to work.
- No text overlap, unwanted horizontal scroll, hidden CTA, or inaccessible control occurs from 360 px through 1920 px widths.
- Desktop rendering reaches the target frame rate under the high or medium tier; ordinary mobile reaches the low-tier target.
- The new design contains no dominant fluorescent outer glow and no global blur.
- Liquid chrome visibly exhibits reflection, surface tension, merging, and separation.
- The hero clearly reads as a gravity archipelago of cratered lunar rock rather than jewelry or generic blobs.
- Automated tests cover quality selection, reduced motion, fallback activation, context-loss handling, scroll-state mapping, and DOM behavior preservation.
- Visual QA covers the hero, every section transition, the registration drawer, mobile layout, reduced motion, and fallback mode.
