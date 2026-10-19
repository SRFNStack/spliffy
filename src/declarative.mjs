import uws from 'uWebSockets.js'

/**
 * Start a declarative response. A declarative response is a handler described up front instead of
 * run per request: it is compiled once at startup and executed entirely inside uWebSockets.js, so
 * requests to the route never enter javascript at all.
 *
 * It can write a status, static headers and body, and copy values from the request: a path
 * parameter, a query parameter, a header or the request body. Call end() last and export the
 * result as the handler.
 *
 * export default {
 *   GET: declarative().writeHeader('content-type', 'text/plain').writeParameterValue('id').end()
 * }
 *
 * Middleware does not run for declarative routes, so a route that has middleware fails to load.
 *
 * @returns {uws.DeclarativeResponse} See https://github.com/uNetworking/uWebSockets.js for the full api
 */
export const declarative = () => new uws.DeclarativeResponse()

/**
 * Whether the given handler is a compiled declarative response
 */
export const isDeclarative = handler => handler instanceof ArrayBuffer
