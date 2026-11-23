# Ataraxia

A relief-first prototype: touch-first sensory play (Break, Knead, Flow, Breathe), with quiet next steps (Learn, Talk, Journal).
Student design project by Nitya Dave.

- Static site, no build step, no backend, no analytics. Everything stays on the device.
- Works offline after the first load (service worker precaches every asset).
- All sound is synthesised with the Web Audio API. Nunito is self-hosted (SIL Open Font License, see `fonts/OFL.txt`).

Live: https://visilean-bhargav.github.io/ataraxia/
Tap point: https://visilean-bhargav.github.io/ataraxia/?tap=coaster

Before every push, regenerate the service worker so phones pick up the new version:

    node tools/build-sw.mjs

Demo helpers: `?demo=1` seeds a week of journal entries (a long press on the wordmark toggles it); `?fast` shortens the step-down and soft-landing waits.
