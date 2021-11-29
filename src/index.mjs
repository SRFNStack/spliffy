import path from 'path'
import { fileURLToPath } from 'url'

/**
 * A helper for creating a redirect handler
 * @param location The location to redirect to
 * @param permanent Whether this is a permanent redirect or not
 */
export const redirect = (location, permanent = true) => () => ({
  statusCode: permanent ? 301 : 302,
  headers: {
    location: location
  }
})

export { default as log } from './log.mjs'
export { parseQuery, setMultiValueKey } from './url.mjs'

/**
 * Startup function for the spliffy server
 * @param config See https://github.com/narcolepticsnowman/spliffy#config
 * @returns {Promise<Server>} Either the https server if https is configured or the http server
 */
export { default } from './start.mjs'

/**
 * Get the dirname for the given meta url
 * @param metaUrl The import.meta.url value to get the dirname from
 * @return {string} The full path to the directory the module is in
 */
export const moduleDirname = metaUrl => path.dirname(fileURLToPath(metaUrl))
