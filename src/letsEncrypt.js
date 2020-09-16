const serverConfig = require( './serverConfig' )
const acme = require( 'acme-client' )
const fs = require( 'fs' )
const path = require( 'path' )
const log = require( './log' )
const os = require( 'os' )
const forge = require( 'node-forge' )
const secure = require( './secure' )
const challenges = {}
const state = {
    current: {
        filesWatched: false,
        renewTriggered: false
    }
}

const orderNew = async( accountKey, keyData, leConfig ) => {
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

        if( challenge.status !== 'valid' ) {
            const keyAuthorization = await client.getChallengeKeyAuthorization( challenge )

            try {
                challenges[ challenge.token ] = challenge
                challenges[ challenge.token ].keyAuthorization = keyAuthorization
                log.info( 'Waiting to complete challenge for domain:', d )
                await client.verifyChallenge( authz, challenge )
                await client.completeChallenge( challenge )
                await client.waitForValidStatus( challenge )
            } catch(e) {
                throw e
            } finally {
                challenges[ challenge.token ] = null
            }
        } else {
            log.info( 'Domain:', d, 'already validated.' )
        }
    } )

    await Promise.all( challengePromises )

    let config = {
        commonName: leConfig.domains.slice( 0, 1 )[ 0 ]
    }
    if( leConfig.domains.length > 1 ) {
        config.altNames = leConfig.domains.slice( 1 )
    }

    const [ _, csr ] = await acme.forge.createCsr( config, keyData )
    await client.finalizeOrder( order, csr )
    let cert = await client.getCertificate( order )
    log.gne( 'Let\'s encrypt certificate created!' )
    return Buffer.from( cert, 'utf8' )
}

const createAccount = async( client, tosAgreed, email ) => {
    const accountPayload = { termsOfServiceAgreed: tosAgreed }

    if( email ) {
        accountPayload.contact = [ `mailto:${email}` ]
    }
    await client.createAccount( accountPayload )
}

/**
 The renewal time will be some minute between 2 weeks before the expiration date and one hour before the expiration date.
 The date to renew is determined by adding a number of days determined by the sha1 hash of the cert,all of the machines network interface mac addresses and the os.hostname.
 This distribution is to avoid rate limiting issues caused by multiple servers with certificates for the same domain.
 lock files are used to prevent clobbering from multiple servers sharing the same files via nas or the like.
 watches are placed on the files and they are reloaded on any event and the server is re-initialized automatically.
 Only the certificate is replaced on renewal
 */
const renewIfNeeded = async( keyFile, certFile, accountKeyFile ) => {
    log.info( 'Checking if certificate needs renewal.' )
    if(!fs.existsSync(keyFile)) throw "Key file missing, cannot renew cert"
    const keyData = await loadOrGenKey( keyFile )
    let certData = await loadOrGenCert( certFile, accountKeyFile, keyData, serverConfig.current.secure.letsEncrypt )
    const macs = Object.entries( os.networkInterfaces() ).reduce( ( interfaces, [ name, i ] ) => interfaces.concat( i ), [] ).map( i => i.mac ).sort().join( '' )
    const md = forge.md.sha1.create()
    md.update( macs + os.hostname() + certData.toString() )
    const hash = md.digest().toHex().slice( -4 ).toLowerCase().split( '' ).reduce( ( result, ch ) => result * 16 + '0123456789abcdefgh'.indexOf( ch ), 0 )
    const certificate = forge.pki.certificateFromPem( certData )
    const issueDate = certificate.validity.notBefore.getTime()
    const expirationDate = certificate.validity.notAfter.getTime()

    const oneMinute = 60000 // 60 seconds * 1000 milliseconds
    const twoWeeks = 1209600000 //oneMinute * 60 minutes * 24 hours * 7 days * 2

    const maxRenewalDate = Math.max(expirationDate - oneMinute * 60, issueDate)
    const minRenewalDate = Math.max( expirationDate - twoWeeks, issueDate )
    const minutesBetween = Math.trunc( ( maxRenewalDate - minRenewalDate ) / oneMinute )
    const renewalDate = minRenewalDate + ( ( hash % minutesBetween ) * oneMinute )

    if( renewalDate < new Date().getTime() ) {
        try {
            log.info( 'Let\'s Encrypt Certificate up for renewal. Ordering new certificate.' )
            certData = await loadOrGenCert( certFile, accountKeyFile, keyData, serverConfig.current.secure.letsEncrypt, true )
        } catch(e) {
            log.error( 'Failed to order new certificate', e )
        }
    } else {
        log.gne( 'Certificate valid.' )
    }
    secure.updateIfChanged( keyData, certData )
}

const runEvery = ( fn, ms ) => fn().then(()=>setTimeout( () => runEvery( fn, ms ), ms ))

//900,000ms == 5min
const withLock = async( fn, maxWaitms = 900000 ) => {
    log.info( 'Attempting to lock', serverConfig.current.secure.letsEncrypt.certPath, 'for up to', maxWaitms / 1000, 'seconds' )
    const started = new Date().getTime()
    let waited = 0
    while( new Date().getTime() - started < maxWaitms ) {
        try {
            fs.writeFileSync( serverConfig.current.secure.letsEncrypt.certPath + '/.lock', process.pid, { flag: 'wx' } )
            log.gne( 'Got lock on', serverConfig.current.secure.letsEncrypt.certPath )
            const result = await fn()
            fs.unlinkSync( serverConfig.current.secure.letsEncrypt.certPath + '/.lock' )
            log.info( 'Released lock on', serverConfig.current.secure.letsEncrypt.certPath )
            return result
        } catch(e) {
            if( ++waited % 10 === 0 ) log.info( 'Still waiting for lock' )
            await new Promise( res => setTimeout( res, 1000 ) )
        }
    }
    throw `Waited too long for lock on certPath. Check ${serverConfig.current.secure.letsEncrypt.certPath}/.lock for the pid holding the lock. Wait for the process or delete the lock file yourself then restart the server`
}


const loadOrGenKey = async( file ) => loadOrGenerate( file, async() => withLock( acme.forge.createPrivateKey ) )

const loadOrGenCert = async( file, accountKeyFile, keyData, leConfig, forceGenerate ) => {
    let accountKey = await loadOrGenKey( accountKeyFile )
    return loadOrGenerate( file, async() => withLock( async() => orderNew( accountKey, keyData, leConfig ) ), forceGenerate )
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
const init = async( bootstrap ) => {
    let leConfig = serverConfig.current.secure.letsEncrypt
    verifyConfig( leConfig )
    if( bootstrap ) secure.setAcmeChallengeProvider( ( token ) => challenges[ token ] )
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
    const newKeyData = await loadOrGenKey( keyFile )
    const newCertData = await loadOrGenCert( certFile, accountKeyFile, newKeyData, leConfig )
    if( bootstrap ) {
        secure.updateIfChanged( newKeyData, newCertData )

        let triggerInitOnFsEvent = ( file ) => () => {
            if( !state.current.renewTriggered ) {
                state.current.renewTriggered = true
                setTimeout( () => {
                    log.info( 'Let\'s Encrypt file change detected' )
                    renewIfNeeded( keyFile, certFile, accountKeyFile )
                        .catch(log.error)
                        .then( () => state.current.renewTriggered = false )
                }, 500 )
            }
            return () => fs.unwatchFile( file )
        }
        fs.watch( keyFile, triggerInitOnFsEvent( keyFile ) )
        fs.watch( accountKeyFile, triggerInitOnFsEvent( accountKeyFile ) )
        fs.watch( certFile, triggerInitOnFsEvent( certFile ) )
    }
    setTimeout( () => runEvery( () => renewIfNeeded( keyFile, certFile, accountKeyFile ).catch(log.error), 10 * 60 * 1000 ) )

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
    if( serverConfig.current.secure.port !== 443 || serverConfig.current.port !== 80 )
        log.info('This server must be reachable via port 80 and port 443 at the domains you specified in your config for let\'s encrypt in order to renew and issue certificates. https://community.letsencrypt.org/t/support-for-ports-other-than-80-and-443-v3/63770/11')

    if( !leConfig.certPath )
        throw 'You must specify the directory to store your cert and private key. Keys and Certs need to be re-used as often as possible to avoid hitting rate-limits for issuing new certs as specified here: https://letsencrypt.org/docs/rate-limits/'

    if( ![ 'staging', 'production' ].includes( leConfig.directory ) )
        throw `letsEncrypt.directory must be either 'staging' or 'production'. These map to require('acme-client').directory.letsencrypt[config.directory]`
}

module.exports = {
    init
}