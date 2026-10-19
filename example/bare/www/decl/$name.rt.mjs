import { declarative } from '../../../../src/index.mjs'

export default {
  GET: declarative().writeHeader('x-decl', 'yes').writeParameterValue('name').end(''),
  POST: declarative().writeStatus('202 Accepted').end('accepted')
}
