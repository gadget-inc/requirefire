module.exports = {
  name: "inner-transitive",
  random: Math.random(),
  requireKeys: Object.keys(require),
  outerTransitiveResolve: require.resolve("./outer_transitive"),
};
