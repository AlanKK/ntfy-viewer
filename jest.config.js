module.exports = {
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // ts-jest compiles each file with options TypeScript 6 flags, and with
        // noEmitOnError that yields no output ("Unable to process ..."). Type
        // errors are still reported through ts-jest's own diagnostics.
        tsconfig: { noEmitOnError: false },
      },
    ],
  },
};
