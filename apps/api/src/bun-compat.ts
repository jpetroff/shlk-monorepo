// BSON 7 probes this optional Node snapshot API during module initialization.
// Bun 1.3.14 exposes the API but throws when called, so hide only that
// optional capability until Bun implements it.
if (typeof Bun !== 'undefined' && typeof process.getBuiltinModule === 'function') {
  const originalGetBuiltinModule = process.getBuiltinModule.bind(process)
  process.getBuiltinModule = ((id: string) => {
    const builtIn = originalGetBuiltinModule(id)
    if (id !== 'v8' || !builtIn || typeof builtIn !== 'object') return builtIn
    return { ...builtIn, startupSnapshot: undefined }
  }) as typeof process.getBuiltinModule
}
