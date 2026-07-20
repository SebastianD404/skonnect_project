/**
 * This file mirrors next.config.ts but in JS so Next can load it
 * when a TypeScript config file is not supported by the installed Next version.
 */
module.exports = {
  // keep in sync with next.config.ts
  serverExternalPackages: ["sharp"],
};
