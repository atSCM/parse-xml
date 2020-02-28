import { builtinModules } from 'module';
import typescript from '@rollup/plugin-typescript';

export default {
  input: './src/index.ts',
  external: [...builtinModules],
  plugins: [
    typescript({
      noEmitOnError: false,
    }),
  ],
  output: [
    {
      format: 'cjs',
      file: './out/index.js',
      sourceMap: true,
    },
    {
      format: 'es',
      file: './out/index.mjs',
      sourceMap: true,
    },
  ],
};
