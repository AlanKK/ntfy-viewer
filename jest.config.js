module.exports = {
  transform: {
    // Strips types only; type checking is done by `tsc` (npm run typecheck)
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "classic" } },
          target: "es2022",
        },
        module: { type: "commonjs" },
      },
    ],
  },
};
