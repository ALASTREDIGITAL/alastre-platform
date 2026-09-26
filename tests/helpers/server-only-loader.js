export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      format: "module",
      shortCircuit: true,
      url: "data:text/javascript,export default {};",
    };
  }
  return nextResolve(specifier, context);
}
