# Testing

Gotta build the package, which you can do once with `pnpm build`, or watch your local development directory and rebuild when things change with `pnpm watch`.

Then gotta use it somewhere, which tends to be easiest in a project. I use `pnpm link` for this.

# Releasing

## Build the package

Run `pnpm build`

## Release the package

Decide what type of new version you're gonna publish and bump the version with `npm version minor|major|patch`

Run `pnpm build && npm publish`
