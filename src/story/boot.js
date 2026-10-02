/**
 * Story-mode boot glue for main.js: registers StorySystem, starts the intro
 * cutscene immediately (so it plays while the engine boots underneath), and
 * returns a gate main.js awaits before starting the frame loop.
 *
 *   const story = await prepareStory(engine, config);
 *   ... engine.init(), prewarm ...
 *   await story.gate(bootPromise);   // cutscene done + "click to start"
 *   engine.start(); story.begin();
 */

import { StorySystem } from './index.js';
import { episode } from './episodes/index.js';
import { playCutscene } from './cutscene.js';
import { waitForStart } from './screens.js';

export async function prepareStory(engine, config) {
  const s = config.story;
  const ep = episode(s.ep);
  engine.add(StorySystem);
  const cut = s.skipIntro || s.autostart
    ? Promise.resolve()
    : playCutscene(ep.intro, { card: { ep: ep.id, name: ep.title, meta: `${ep.place} · ${ep.clock}` } });

  let booted;
  const bootPromise = new Promise((r) => (booted = r));
  // the loading card goes up the moment the cutscene ends, not when boot does
  const gate = cut.then(() => (s.autostart ? bootPromise : waitForStart(bootPromise, { ep: ep.id, name: ep.title })));

  return {
    /** Resolves once boot is done and the player has clicked through. */
    async gate() {
      booted();
      await gate;
    },
    begin() {
      engine.registry.get('story').begin();
    },
  };
}
