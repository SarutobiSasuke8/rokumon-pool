export function createRunState(seed = 1) { return { seed, score: 0, elapsedMs: 0, status: "playing" }; }
export function snapshotRun(state) { return JSON.parse(JSON.stringify(state)); }
