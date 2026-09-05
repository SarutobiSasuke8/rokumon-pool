# Save and State Contract

- Save only serializable simulation state and user preferences; never Phaser, Three.js, DOM, or audio objects.
- Version every persisted schema. On a version mismatch, migrate deliberately or reset safely with a visible explanation.
- Test game-over and restart from a clean state: score, entities, input, timers, audio, UI, and progression must agree.
- Keep debug snapshots readable enough to diagnose a failed smoke path.
- Treat local storage as untrusted convenience data; validate parsed values and tolerate corruption.
