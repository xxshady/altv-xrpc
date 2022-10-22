import process from 'process'
import { build } from 'esbuild'
import { 
  getSharedBuildOptions, 
  typesGenerator 
} from '../build-src/shared-options'

const sharedOptions = getSharedBuildOptions(process)

build({
  ...sharedOptions,
  format: 'esm',
  platform: 'node',
  entryPoints: ['./src/index.ts'],
  outdir: './dist',
  external: [
    ...sharedOptions.external,
  ],
}).then(typesGenerator())
