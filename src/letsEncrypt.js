const serverConfig = require( './serverConfig' )
const acme = require( 'acme-client' )
const fs = require( 'fs' )
const path = require( 'path' )
const log = require( './log' )
const os = require( 'os' )
const forge = require( 'node-forge' )
const https = require( 'https' )
const handler = require( './handler' )
const challenges = {}
const state = {
    current: {
        filesWatched: false,
        initTriggerd: false
    }
}

const orderNew = async( accountKey, leConfig ) => {
    log.info( 'Ordering new let\'s encrypt certificate...' )
    let client = new acme.Client( {
                                      directoryUrl: acme.directory.letsencrypt[ leConfig.directory ],
                                      accountKey: accountKey
                                  } )
    //If the keyFile exists already, the account will just be retrieved instead of created. https://github.com/ietf-wg-acme/acme/blob/master/draft-ietf-acme-acme.md#finding-an-account-url-given-a-key
    await createAccount( client, leConfig.termsOfServiceAgreed, leConfig.email )

    let domainsToOrder = leConfig.domains.map( d => ( { type: 'dns', value: d } ) )

    const order = await client.createOrder( { identifiers: domainsToOrder } )
    const authorizations = await client.getAuthorizations( order )

    const challengePromises = authorizations.map( async( authz ) => {
        const d = authz.identifier.value

        /* Select challenge based on priority */
        const challenge = authz.challenges.filter( a => a.type === 'http-01' ).slice( 0, 1 )[ 0 ]

        if( !challenge ) {
            throw new Error( `Unable to select challenge for ${d}, no challenge found` )
        }

        const keyAuthorization = await client.getChallengeKeyAuthorization( challenge )

        try {
            challenges[ challenge.token ] = challenge
            challenges[ challenge.token ].keyAuthorization = keyAuthorization
            await client.verifyChallenge( authz, challenge )
            await client.completeChallenge( challenge )
            await client.waitForValidStatus( challenge )
        } finally {
            challenges[ challenge.token ] = null
        }
    } )

    await Promise.all( challengePromises )

    let config = {
        commonName: leConfig.domains.slice( 0, 1 )[ 0 ]
    }
    if( leConfig.domains.length > 1 ) {
        config.altNames = leConfig.domains.slice( 1 )
    }

    const [ _, csr ] = await acme.forge.createCsr( config, serverConfig.current.ssl.keyData )
    await client.finalizeOrder( order, csr )
    let cert = await client.getCertificate( order )
    log.info( 'Let\'s encrypt certificate created!' )
    return Buffer.from(cert, 'utf8')
}

const createAccount = async( client, tosAgreed, email ) => {
    const accountPayload = { termsOfServiceAgreed: tosAgreed }

    if( email ) {
        accountPayload.contact = [ `mailto:${email}` ]
    }
    await client.createAccount( accountPayload )
}

/**
 The renewal date will be between 1 week after the issue date and 1 week before the expiration date.
 The date to renew is determined by adding a number of days determined by the sha1 hash of the cert and mac address.
 This distribution is to avoid rate limiting issues caused by multiple servers with certificates for the same domain.
 lock files are used to prevent clobbering from multiple servers sharing the same files via nas or the like.
 watches are placed on the files and they are reloaded on any event and the server is re-initialized automatically.
 Only the certificate is replaced on renewal
 */
const renewIfNeeded = async( keyFile, certFile, accountKeyFile ) => {
    log.info("Checking letEncrypt renewal")
    const cert = fs.readFileSync( certFile )
    const macs = Object.entries( os.networkInterfaces() ).reduce( ( interfaces, [ name, i ] ) => interfaces.concat( i ), [] ).map( i => i.mac ).sort().join( '' )
    const md = forge.md.sha1.create()
    md.update( macs + cert.toString() )
    const hash = md.digest().toHex().slice( -4 ).toLowerCase().split( '' ).reduce( ( result, ch ) => result * 16 + '0123456789abcdefgh'.indexOf( ch ), 0 )
    const certificate = forge.pki.certificateFromPem( cert )
    const issueDate = certificate.validity.notBefore.getTime()
    const expirationDate = certificate.validity.notAfter.getTime()

    const oneDay = 24 * 60 * 60 * 1000 //hours * minutes * seconds * milliseconds
    const oneWeek = 7 * oneDay

    const maxRenewalDate = Math.max( expirationDate - oneWeek, issueDate )
    const minRenewalDate = Math.min( issueDate + oneWeek, expirationDate )
    const daysBetween = Math.trunc( ( maxRenewalDate - minRenewalDate ) / oneDay )
    const renewalDate = minRenewalDate + ( ( hash % daysBetween ) * oneDay )
    if( renewalDate < new Date().getTime() ) {
        try {
            log.info( 'Let\'s Encrypt Certificate up for renewal. Ordering new certificate.' )
            //ensure we have the latest private key before we issue new certs
            serverConfig.current.ssl.keyData = await loadOrGenKey( keyFile )
            serverConfig.current.ssl.certData = await loadOrGenCert( certFile, accountKeyFile, serverConfig.current.ssl.letsEncrypt, true )
            restartHttps()
        } catch(e) {
            log.error( 'Failed to order new certificate', e )
        }
    } else {
        log.info("Certificate still valid.")
        setTimeout( () => renewIfNeeded( keyFile, certFile, accountKeyFile ), oneDay / 4 )
    }
}

const restartHttps = () => {
    let oldServer = serverConfig.current.httpsServer
    log.info("LetsEncrypt ssl information changed. Restarting https server.")
    serverConfig.current.httpsServer = https.createServer(
        {
            key: serverConfig.current.ssl.keyData,
            cert: serverConfig.current.ssl.certData
        },
        handler
    )
    oldServer.close( () => serverConfig.current.httpsServer.listen( serverConfig.current.ssl.port ) )
    oldServer = null
}
//900,000ms == 5min
const withLock = async( fn, maxWaitms = 900000 ) => {
    const started = new Date().getTime()
    while( new Date().getTime() - started < maxWaitms ) {
        try {
            fs.writeFileSync( serverConfig.current.ssl.letsEncrypt.certPath + '/.lock', process.pid, { flag: 'wx' } )
            const result = await fn()
            fs.unlinkSync( serverConfig.current.ssl.letsEncrypt.certPath + '/.lock' )
            return result
        } catch(e) {
            await new Promise( res => setTimeout( res, 500 ) )
        }
    }
    throw `Waited too long for lock on certPath. Check ${serverConfig.current.ssl.letsEncrypt.certPath}/.lock for the pid holding the lock. Wait for the process or delete the lock file yourself then restart the server`
}


const loadOrGenKey = async( file ) => loadOrGenerate( file, async() => withLock( acme.forge.createPrivateKey ) )

const loadOrGenCert = async( file, accountKeyFile, leConfig, forceGenerate ) => {
    let accountKey = await loadOrGenKey( accountKeyFile )
    return loadOrGenerate( file, async() => withLock( async() => orderNew( accountKey, leConfig ) ), forceGenerate )
}

const loadOrGenerate = async( file, generate, forceGenerate = false, tries = 0 ) => {
    if( !fs.existsSync( file ) || forceGenerate ) {
        const data = await generate()
        try {
            fs.writeFileSync( file, data )
            return data
        } catch(e) {
            if( tries >= 4 ) {
                throw `Unable to save file ${file} ${e}`
            }
            return new Promise(
                resolve =>
                    setTimeout( () => {
                        loadOrGenKey( file, generate, forceGenerate, ++tries )
                            .then( key => resolve( key ) )
                    }, 1000 )
            )
        }

    } else {
        return fs.readFileSync( file )
    }
}
const init = async(bootstrap) => {
    let leConfig = serverConfig.current.ssl.letsEncrypt
    verifyConfig( leConfig )

    if( !fs.existsSync( leConfig.certPath ) ) {
        fs.mkdirSync( leConfig.certPath, { recursive: true } )
        log.info( 'Created cert directory', leConfig.certPath )
    }
    leConfig.certPath = path.resolve( leConfig.certPath )
    const keyFile = leConfig.certPath + '/' + ( leConfig.keyFileName || 'letsEncrypt.key' )
    const certFile = leConfig.certPath + '/' + ( leConfig.certFileName || 'letsEncrypt.cert' )
    const accountKeyFile = leConfig.certPath + '/' + ( leConfig.accountKeyFile || 'account.key' )

    let certExists = fs.existsSync( certFile )
    if( certExists && !fs.existsSync( keyFile ) )
        throw `The key for the provided cert ${certFile} is missing. Remove the cert file or provide the key to continue`

    let lastKeyData = serverConfig.current.ssl.keyData
    let lastCertData = serverConfig.current.ssl.certData

    serverConfig.current.ssl.keyData = await loadOrGenKey( keyFile )
    serverConfig.current.ssl.certData = await loadOrGenCert( certFile, accountKeyFile, leConfig )


    if(!bootstrap && (
        (lastCertData && !lastCertData.equals(serverConfig.current.ssl.certData))
        ||(lastKeyData && !lastKeyData.equals(serverConfig.current.ssl.keyData)))
    ) {
        restartHttps()
    }

    if( bootstrap ) {
        let triggerInit = ( file ) => () => {
            if(!state.current.initTriggered ) {
                state.current.initTriggered = true
                setTimeout( () => {
                    log.info( 'letsEncrypt value change detected, re-initializing ssl' )
                    init()
                        .then( () => state.current.initTriggered = false )
                }, 100 )
            }
            return () => fs.unwatchFile( file )
        }
        fs.watch( keyFile, triggerInit( keyFile ) )
        fs.watch( accountKeyFile, triggerInit( accountKeyFile ) )
        fs.watch( certFile, triggerInit( certFile ) )
    }
    renewIfNeeded( keyFile, certFile, accountKeyFile )

}

const verifyConfig = ( leConfig ) => {
    if( !leConfig.termsOfServiceAgreed )
        throw 'you must agree to terms of service. Set termsOfServiceAgreed to use letsEncrypt'
    if( !leConfig.domains
        || !Array.isArray( leConfig.domains )
        || leConfig.domains.length < 1
    )
        throw 'you must supply a array of at least one domains to get lets encrypt certs for'

    leConfig.domains.forEach( d => {
        if( d.startsWith( '*.' ) ) {
            throw 'wildcard domains are not supported because they require dns verification'
        }
    } )
    if( serverConfig.current.ssl.port !== 443 || serverConfig.current.port !== 80 )
        throw 'The port and ssl.port must be set to 80 and 443 in order to use let\'s encrypt. https://community.letsencrypt.org/t/support-for-ports-other-than-80-and-443-v3/63770/11'

    if( !leConfig.certPath )
        throw 'You must specify the directory to store your cert and private key. Keys and Certs need to be re-used as often as possible to avoid hitting rate-limits for issuing new certs as specified here: https://letsencrypt.org/docs/rate-limits/'

    if( ![ 'staging', 'production' ].includes( leConfig.directory ) )
        throw `letsEncrypt.directory must be either 'staging' or 'production'. These map to require('acme-client').directory.letsencrypt`
}

module.exports = {
    init,
    challenge( token ) {
        return challenges[ token ]
    }
}