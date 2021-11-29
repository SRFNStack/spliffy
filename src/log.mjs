import util from 'util'

const inspect = util.inspect
const levelOrder = { TRACE: 10, DEBUG: 20, INFO: 30, ACCESS: 30, 'GOOD NEWS EVERYONE!': 30, WARN: 40, ERROR: 50, FATAL: 60, NONE: 100 }
let logLevel = levelOrder.INFO

const ifLevelEnabled = (fn, level, args) => {
  const configLevel = levelOrder[logLevel] || levelOrder.INFO
  if (levelOrder[level] >= configLevel) {
    fn(`[${new Date().toISOString()}] [${level}]  ${args.map(a => typeof a === 'string' ? a : inspect(a, { depth: null })).join(' ')}`)
  }
}

const callLog = (level, logImplFn, defaultFn, args) => {
  if (logImpl && typeof logImpl[logImplFn] === 'function') {
    logImpl[logImplFn](...args)
  } else {
    ifLevelEnabled(defaultFn, level, args)
  }
}

let logImpl = null

export default {
  setLogLevel (level) {
    level = level.toUpperCase()
    if (!(level in levelOrder)) {
      throw new Error(`Invalid level: ${level}`)
    }
    logLevel = level
  },
  setLogger (logger) {
    logImpl = logger
  },
  trace () {
    callLog('TRACE', 'trace', console.trace, [...arguments])
  },
  debug () {
    callLog('DEBUG', 'debug', console.debug, [...arguments])
  },
  info () {
    callLog('INFO', 'info', console.info, [...arguments])
  },
  gne () {
    callLog('GOOD NEWS EVERYONE!', 'info', console.info, [...arguments])
  },
  access () {
    callLog('ACCESS', 'info', console.info, [...arguments])
  },
  warn () {
    callLog('WARN', 'warn', console.warn, [...arguments])
  },
  error () {
    callLog('ERROR', 'error', console.error, [...arguments].map(arg => arg.stack ? arg.stack : arg))
  },
  fatal () {
    callLog('ERROR', 'error', console.error, [...arguments].map(arg => arg.stack ? arg.stack : arg))
  }
}
