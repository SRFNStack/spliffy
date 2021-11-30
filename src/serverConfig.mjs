import { initContentHandlers } from './content.mjs'
import { validateMiddleware } from './middleware.mjs'
import log from './log.mjs'

const defaultHeaders = {
  acceptsDefault: '*/*',
  defaultContentType: '*/*'
}
// this is mainly for performance reasons
const nonsense = [
  'I\'m toasted',
  'that hurt',
  'your interwebs!',
  'I see a light...',
  'totally zooted',
  'misplaced my bits',
  'maybe reboot?',
  'what was I doing again?',
  'my cabbages!!!',
  'Leeerrroooyyy Jeeenkins',
  'at least I have chicken'
]

export const randomNonsense = () => `[OH NO, ${nonsense[Math.floor(Math.random() * nonsense.length)]}]`

export async function initConfig (userConfig) {
  const config = Object.assign({}, userConfig)

  if (!('decodePathParameters' in config)) {
    config.decodePathParameters = false
  }

  if (!('decodeQueryParams' in config)) {
    config.decodeQueryParams = false
  }

  if (!('extendIncomingMessage' in config)) {
    config.extendIncomingMessage = false
  }

  if (!('parseCookie' in config)) {
    config.parseCookie = false
  }

  if (!('writeDateHeader' in config)) {
    config.writeDateHeader = false
  }

  config.acceptsDefault = config.acceptsDefault || defaultHeaders.acceptsDefault
  config.defaultContentType = config.defaultContentType || defaultHeaders.defaultContentType

  config.contentHandlers = initContentHandlers(config.contentHandlers || {})
  config.resolveWithoutExtension = config.resolveWithoutExtension || []
  if (!Array.isArray(config.resolveWithoutExtension)) {
    config.resolveWithoutExtension = [config.resolveWithoutExtension]
  }

  if (config.resolveWithoutExtension.indexOf('.htm') === -1) {
    config.resolveWithoutExtension.push('.htm')
  }
  if (config.resolveWithoutExtension.indexOf('.html') === -1) {
    config.resolveWithoutExtension.push('.html')
  }

  if (config.middleware) {
    validateMiddleware(config.middleware)
  }

  if (!('logAccess' in config)) {
    config.logAccess = false
  }
  if ('logLevel' in config) {
    log.setLogLevel(config.logLevel)
  }
  if (!('ignoreFilesMatching' in config)) {
    config.ignoreFilesMatching = []
  } else if (!Array.isArray(config.ignoreFilesMatching)) {
    config.ignoreFilesMatching = [config.ignoreFilesMatching]
  }
  if (!('allowTestFileRoutes' in config)) {
    config.allowTestFileRoutes = false
  }
  config.port = config.port || 10420
  if (!config.httpPort) {
    config.httpPort = config.port - 1
  }

  if (config.logger) {
    log.setLogger(config.logger)
  }

  if ((config.httpsKeyFile && !config.httpsCertFile) || (!config.httpsKeyFile && config.httpsCertFile)) {
    throw new Error('You must provide both httpsKeyFile and httpsCertFile')
  }
  return config
}
