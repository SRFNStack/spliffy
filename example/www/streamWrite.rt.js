const particles = [
    {
        name: 'baryon'
    },
    {
        name: 'bottom quark'
    },
    {
        name: 'chargino'
    },
    {
        name: 'charm quark'
    },
    {
        name: 'down quark'
    },
    {
        name: 'electron'
    },
    {
        name: 'electron neutrino'
    },
    {
        name: 'fermion'
    },
    {
        name: 'gluino'
    },
    {
        name: 'gluon'
    },
    {
        name: 'gravitino'
    },
    {
        name: 'graviton'
    },
    {
        name: 'boson'
    },
    {
        name: 'higgs boson'
    },
    {
        name: 'higgsino'
    },
    {
        name: 'neutralino'
    },
    {
        name: 'neutron'
    },
    {
        name: 'meson'
    },
    {
        name: 'muon'
    },
    {
        name: 'muon nuetrino'
    },
    {
        name: 'positron'
    },
    {
        name: 'photino'
    },
    {
        name: 'photon'
    },
    {
        name: 'proton'
    },
    {
        name: 'sleptons'
    },
    {
        name: 'sneutrino'
    },
    {
        name: 'strange quark'
    },
    {
        name: 'squark'
    },
    {
        name: 'tau'
    },
    {
        name: 'tau neutrino'
    },
    {
        name: 'top quark'
    },
    {
        name: 'up quark'
    },
    {
        name: 'w boson'
    },
    {
        name: 'wino'
    },
    {
        name: 'z boson'
    },
    {
        name: 'zino'
    },
]

const writeParticles = async res => {
    let p = Promise.resolve()
    for( let particle of particles ) {
        p = writeParticle( res, particle )
    }
    return p
}

const writeParticle = async ( res, particle ) => res.write( `<li>${particle.name}</li>` )

module.exports = {
    GET: async ({res}) => {
        res.headers['Content-Type'] = 'text/html'
        res.streaming = true
        res.write('<html lang="en"><body>Particles<ul>')
        writeParticles(res).finally(()=>{
            res.write('</ul></body></html>')
            res.end()
        })
    }
}