import { compression } from '../../../../src/index.mjs'

export const middleware = [compression({ threshold: 512 })]
