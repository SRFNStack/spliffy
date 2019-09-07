const determineVariant = ( shenanigans ) => shenanigans && 'shenanigans' || null

module.exports = ( { shenanigans } ) => ({ variant: determineVariant( shenanigans ) })