// TypeScript 7 (the native compiler) no longer ships the JavaScript compiler API that
// TypeDoc depends on. The project builds with TypeScript 7, but TypeDoc is given its own
// private TypeScript 6 so `pnpm docs` keeps working until TypeDoc supports TypeScript 7.
const DOCS_TYPESCRIPT = "~6.0.3";

function readPackage(pkg) {
  if (pkg.name === "typedoc") {
    if (pkg.peerDependencies) delete pkg.peerDependencies.typescript;
    pkg.dependencies = { ...pkg.dependencies, typescript: DOCS_TYPESCRIPT };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
