module.exports = {
  testPathIgnorePatterns: ["node_modules", "/pkg"],
  transform: {
    "^.+\\.[jt]sx?$": ["@swc/jest", { sourceMaps: "inline" }],
  },
};
