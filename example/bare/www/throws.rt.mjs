import { BadRequestError } from '../../../src/index.mjs'

export default {
  GET: () => { throw new BadRequestError({ errors: ['nope'] }) },
  POST: async () => { throw new BadRequestError({ errors: ['async nope'] }) }
}
