import { initConfig, randomNonsense } from './serverConfig.mjs'
import log from './log.mjs'
import { startServer } from './server.mjs'

export default async function (config) {
  if (!config || !config.routeDir) {
    throw new Error('You must supply a config object with at least a routeDir property. routeDir should be a full path.')
  }
  process
    .on('unhandledRejection', (reason, p) => {
      log.error(randomNonsense(), reason, 'Unhandled Rejection at Promise', p)
    })
    .on('uncaughtException', (err, origin) => {
      log.error(randomNonsense(), `Caught unhandled exception: ${err}\n` +
                `Exception origin: ${origin}`)
    })

  log.gne('Starting Spliffy!')
  const configWithDefaults = await initConfig(config)
  return startServer(configWithDefaults).catch(e => {
    log.error(randomNonsense(), 'Exception during startup:', e)
    // Spliffy threw an exception, or a route handler failed to load.
    process.exit(420)
  })
}
