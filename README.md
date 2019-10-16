# Spliffy

> directory based routing with js request handlers and static file serving

## Getting started
Create a directories for your app

`mkdir -p ~/app/www`

Install spliffy

`cd ~/app && npm install spliffy`

Create a handler for the desired route name 

`vi ~/app/www/spliffy.js`
```js
module.exports = {
    GET: () => ({hello: "spliffy"})
}

```
Create the start script, ```vi ~/app/serve.js``` 
```js
require('spliffy')({routeDir: __dirname+ '/www'})
```

because the routeDir is ~/app/www, the filename `spliffy.js` creates the path `/spliffy`

The object passed to spliffy is the config. See the [Config](#Config) section for more information.

routeDir is the only required property and should be an absolute path.

`10420` is the default port for http, and can be changed by setting the port in the config

start the server
`node ~/app/serve.js`

Go to `localhost:10420/spliffy`

# Documentation
See the full documentation here: https://narcolepticsnowman.github.io/spliffy/

#### [Examples](https://github.com/narcolepticsnowman/spliffy/tree/master/example)
