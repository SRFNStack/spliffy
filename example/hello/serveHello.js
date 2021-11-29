require('../../src/index')(
  {
    routeDir: require('path').join(__dirname, '/www'),
    port: 11420,
    logAccess: false
  }
)
