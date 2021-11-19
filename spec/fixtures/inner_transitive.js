module.exports = {
  name: "inner-transitive",
  now: new Date(),
  requireKeys: Object.keys(require),
  outerTransitiveResolve: require.resolve("./outer_transitive"),
};
