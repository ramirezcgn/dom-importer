import esbuild from 'esbuild';

const formats = [
  { format: 'esm', ext: '.js' },
  { format: 'cjs', ext: '.cjs' },
];

const entries = [
  { in: 'src/index.ts', out: 'dist/index' },
];

for (const { in: entryPoint, out } of entries) {
  for (const { format, ext } of formats) {
    await esbuild.build({
      entryPoints: [entryPoint],
      format,
      bundle: true,
      sourcemap: true,
      outfile: `${out}${ext}`,
    });
  }
}

console.log('Build complete.');
