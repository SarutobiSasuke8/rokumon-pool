# Distribution and Games Hub Contract

## Browser Shipping Defaults

- Build with relative asset paths when the game may be copied, embedded, or hosted below an arbitrary path.
- Bundle runtime dependencies for normal shipping; do not rely on an unpinned CDN unless offline support is explicitly out of scope.
- Record the expected entry file, orientation, browser/device support, and bundle budget in the project brief.

## Games Hub Addon

Install with `-GamesHub`. The adapter must:

- remain a no-op during standalone play;
- report `ready`, throttled score changes, `gameOver`, and declared durable `event`s only when the host bridge exists;
- keep game mechanics independent of the host;
- document the hub manifest and servable bundle path.

For a hub deployment, run a production build, test from the final relative path, and verify the game does not require network-only runtime dependencies.
