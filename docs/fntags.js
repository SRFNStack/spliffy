/**
 * A helper function that will append the given children to the given root element
 * @param root Either an element id string or an element itself
 * @param children The children to append to the root element
 */
export const fnapp = ( root, ...children ) => {
    if( typeof root === 'string' ) {
        root = document.getElementById( root )
        if( !root ) throw new Error( `No such element with id ${root}` ).stack
    }
    if( !isNode( root ) ) throw new Error( 'Invalid root element' ).stack
    root.append( ...children.map( c => renderElement( c, root ) ) )
}

/**
 * Check if a value is an dom node
 * @param el
 * @returns {boolean}
 */
export const isNode = ( el ) =>
    el &&
    ( el instanceof Node || el instanceof Element || el.constructor.toString().search( /object HTML.+Element/ ) > -1 )

/**
 * Bind one or more states to the given element.
 * @param state Either a single state object or an array of state objects to watch
 * @param element An element that will be updated whenever the state changes.
 *          If passing a function, the function will be executed on each state change and the returned value will be rendered to a component.
 *          This function receives the new state as it's only argument.
 *
 *          If passing a dom node/element, then you must also supply an update function to perform the update on the element.
 *          This is the preferred method for inputs as it ensures the element is not re-created and focus is lost.
 *
 *          Other inputs are not allowed
 *
 *          Avoid changing the bound state unconditionally in either update case as it can cause an infinite update loop.
 *
 * @param update A function to perform a manual update with.
 *          This function receives two arguments. The element and the new state
 */
export const fnbind = ( state, element, update ) => {
    if( typeof element !== 'function' && !isNode( element ) ) throw new Error( 'You can only bind functions and Elements' ).stack
    if( isNode( element ) && typeof update !== 'function' ) throw new Error( 'You must supply an update function when binding an element' ).stack
    const states = Array.isArray( state ) && state || [ state ]

    const el = states.reduce( ( el, st ) => {
                                  if( !isfnstate( st ) ) throw new Error( `State: ${st} is not initialized. Use fnstate() to initialize.` ).stack
                                  st._fn_state_info.addObserver( el, element, update )
                                  el.current = typeof element === 'function' ? renderElement( element( state ) ) : element
                                  return el
                              },
                              { current: marker() }
    )

    return el.current
}

/**
 * Create a state object that can be bound to.
 * @param initialState The initial state
 * @returns A proxy that notifies watchers when properties are set
 */
export const fnstate = ( initialState ) => {
    if( typeof initialState !== 'object' ) throw new Error( 'initial state must be an object' ).stack
    let observers = {}
    const notify = ( method ) => ( ...args ) => {
        let result = Reflect[ method ]( ...args )
        for( let key in observers ) {
            observers[ key ].onNotify( args[ 0 ] )
        }
        return result
    }
    const p = new Proxy( initialState, {
        set: notify( 'set' ),
        deleteProperty: notify( 'deleteProperty' )
    } )

    function addObserver( el, element, update ){
        tagElement( el.current )
        observers[ getElId( el.current ) ] = {
            currentEl(){return el.current},
            updateCurrent( newElement ) {
                if( newElement && isNode( newElement ) ) {
                    tagElement( newElement )
                    if( getElId( el.current ) !== getElId( newElement ) ) {

                        el.current.replaceWith( newElement )
                        el.current = newElement
                        if(isNode(element)) element = newElement
                        observers[getElId(newElement)] = observers[getElId( el.current )]
                        delete observers[ getElId( el.current ) ]
                    }
                }
            },
            onNotify( state ) {
                this.updateCurrent( update ? update( el.current, state ) : renderElement( element( state ) ) )
            }
        }
    }

    Object.defineProperty( p, '_fn_state_info', {
        value: Object.freeze(
            {
                addObserver,
                reset: ( reInit ) => {
                    observers = {}
                    if( reInit ) Object.assign( p, initialState )
                },
                findElement: (filter) =>
                {
                    let foundId = Object.keys( observers ).find( o => filter(observers[ o ].currentEl()) )
                    return foundId && observers[foundId].currentEl() || null
                }
            } ),
        enumerable: false,
        writable: false
    } )

    return p
}

/**
 * find an element on a state using a filter function. The first matching element is returned.
 * @param state The state to find elements on
 * @param filter The filter function that takes a dom element and returns a boolean
 */
export const findElement = ( state, filter = ()=>true ) => state[ '_fn_state_info' ].findElement( filter )

/**
 * Clear the observers and optionally set the state back to the initial state. This will remove all bindings to this state, meaning elements will no longer be updated.
 * @param state The state to reset
 * @param reinit Whether to change the values of the state back to the initial state after removing the observers
 * @returns {*|void}
 */
export const resetState = ( state, reinit = false ) => state[ '_fn_state_info' ] && state[ '_fn_state_info' ].reset( reinit )
/**
 * Convert non dom nodes to text nodes
 */
export const renderElement = ( element ) => isNode( element ) ? element : document.createTextNode( String( element ) )


const isfnstate = ( state ) => state.hasOwnProperty( '_fn_state_info' )

let lastId = 0
const fntag = '_fn_element_info'

const tagElement = ( el ) => {
    if( !el.hasOwnProperty( fntag ) ) {
        Object.defineProperty( el, fntag, {
            value: Object.freeze(
                {
                    id: lastId++
                } ),
            enumerable: false,
            writable: false
        } )
    }
}

const getTag = ( el ) => el[ fntag ]
const isTagged = ( el ) => el && el.hasOwnProperty( fntag )
const getElId = ( el ) => isTagged( el ) && getTag( el ).id

/**
 * An element that is displayed only if the the current route starts with elements path attribute.
 *
 * For example,
 *  route({path: "/proc"},
 *      div(
 *          "proc",
 *          div({path: "/cpuinfo"},
 *              "cpuinfo"
 *              )
 *          )
 *      )
 *
 *  You can override this behavior by setting the attribute, absolute to any value
 *
 *  route({path: "/usr"},
 *      div(
 *          "proc",
 *          div({path: "/cpuinfo", absolute: true},
 *              "cpuinfo"
 *              )
 *          )
 *      )
 *
 * @param children The attributes and children of this element.
 * @returns HTMLDivElement
 */
export const route = ( ...children ) => {

    const routeEl = h( 'div', ...children )
    const display = routeEl.style.display
    let path = routeEl.getAttribute( 'path' )
    let absolute = !!routeEl.absolute || routeEl.getAttribute( 'absolute' ) === 'true'
    if( !path ) {
        throw new Error( 'route must have a string path attribute' ).stack
    }
    return fnbind( pathState, routeEl, () => {
        if( shouldDisplayRoute( path, absolute ) ) {
            routeEl.style.display = display
        } else {
            routeEl.style.display = 'none'
        }
    } )
}

/**
 * A link component that is a link to another route in this single page app
 * @param children The attributes of the anchor element and any children
 */
export const fnlink = ( ...children ) => {
    let a = h( 'a', ...children )

    let to = a.getAttribute( 'to' )
    if( !to ) {
        throw new Error( 'fnlink must have a "to" string attribute' ).stack
    }
    a.addEventListener( 'click', ( e ) => {
        e.preventDefault()
        goTo( to )
    } )
    a.setAttribute(
        'href',
        pathState.info.rootPath + ensureSlash( to )
    )
    return a
}

/**
 * A function to navigate to the specified route
 * @param route
 */
export const goTo = ( route ) => {
    let newPath = window.location.origin + pathState.info.rootPath + ensureSlash( route )
    history.pushState( {}, route, newPath )
    pathState.info = Object.assign( pathState.info, {
        currentRoute: route.split(/[#?]/)[0]
    } )
    if( newPath.indexOf( '#' ) > -1 ) {
        const el = document.getElementById( decodeURIComponent( newPath.split( '#' )[ 1 ] ) )
        el && el.scrollIntoView()
    } else {
        window.scrollTo(0,0)
    }
}

/**
 * An element that only renders the first route that matches and updates when the route is changed
 * The primary purpose of this element is to provide catchall routes for not found pages and path variables
 * @param children
 */
export const routeSwitch = ( ...children ) => {
    const sw = h( 'div', getAttrs( children ) )
    return fnbind( pathState, () => {
                       while( sw.firstChild ) {
                           sw.removeChild( sw.firstChild )
                       }
                       for( let child of children ) {
                           const rendered = renderElement( child )
                           if( rendered.getAttribute( 'path' ) ) {
                               if( shouldDisplayRoute( rendered.getAttribute( 'path' ), !!rendered.absolute || rendered.getAttribute( 'absolute' ) === 'true' ) ) {
                                   sw.append( rendered )
                                   return sw
                               }
                           }
                       }
                   }
    )
}

const ensureSlash = ( part ) => {
    part = part.startsWith( '/' ) ? part : '/' + part
    return part.endsWith( '/' ) ? part.slice( 0, -1 ) : part
}

export const pathState = fnstate(
    {
        info: {
            rootPath: ensureSlash( window.location.pathname ),
            currentRoute: '/'
        }
    } )

/**
 * Set the root path of the app. This is necessary to make deep linking work in cases where the same html file is served from all paths.
 */
export const setRootPath = ( rootPath ) => pathState.info = Object.assign( pathState.info, { rootPath: ensureSlash( rootPath ), currentRoute: window.location.pathname } )

window.addEventListener( 'popstate', () =>
    pathState.info = Object.assign(
        pathState.info, {
            currentRoute: window.location.pathname.replace( pathState.info.rootPath, '' ) || '/'
        }
    )
)

const shouldDisplayRoute = ( route, isAbsolute ) => {
    let path = pathState.info.rootPath + ensureSlash( route )
    const currPath = window.location.pathname
    if( isAbsolute ) {
        return currPath === path || currPath === ( path + '/' )
    } else {
        const pattern = path.replace( /^(.*)\/([^\/]*)$/, '$1/?$2([/?#]|$)' )
        return !!currPath.match( pattern )
    }

}

/**
 * A function to create dom elements with the given attributes and children.
 * If an argument is a non-node object it is considered an attributes object, attributes are combined with Object.assign in the order received.
 * All standard html attributes can be passed, as well as any other property.
 * Strings are added as attributes via setAttribute, functions are added as event listeners, other types are set as properties.
 *
 * The rest of the arguments will be considered children of this element and appended to it in the same order as passed.
 *
 * @param tag html tag to use when created the element
 * @param children optional attrs and children for the element
 * @returns HTMLElement an html element
 *

 */
export const h = ( tag, ...children ) => {
    let element = document.createElement( tag )
    if( children ) {
        children.forEach( ( child ) => {
            if( isAttrs( child ) ) {
                Object.keys( child ).forEach( a => {
                    let attr = child[ a ]
                    if( a === 'style' && typeof attr === 'object' ) {
                        Object.keys( attr ).forEach( ( style ) => {
                            let match = attr[ style ].toString().match( /(.*)\W+!important\W*$/ )
                            if( match )
                                element.style.setProperty( style, match[ 1 ], 'important' )
                            else
                                element.style.setProperty( style, attr[ style ] )
                        } )
                    } else if( a.startsWith( 'on' ) && typeof attr === 'function' ) {
                        element.addEventListener( a.substring( 2 ), attr )
                    } else if( typeof attr === 'string' ) {
                        element.setAttribute( a, attr )
                    } else {
                        Object.defineProperty( element, a, {
                            value: attr,
                            enumerable: false
                        } )
                    }
                } )
            } else {
                if( Array.isArray( child ) )
                    child.forEach( c => element.append( renderElement( c ) ) )
                else
                    element.append( renderElement( child ) )
            }
        } )
    }
    return element
}

const isAttrs = ( val ) => val && typeof val === 'object' && !Array.isArray( val ) && !isNode( val )
/**
 * Aggregates all attribute objects from a list of children
 * @param children
 * @returns {{}} A single object containing all of the aggregated attribute objects
 */
export const getAttrs = ( children ) => children.reduce( ( attrs, child ) => {
    if( isAttrs( child ) )
        Object.assign( attrs, child )
    return attrs
}, {} )

/**
 * A hidden div node to mark your place in the dom
 * @returns {HTMLDivElement}
 */
const marker = ( attrs ) => h( 'div', Object.assign( attrs || {}, { style: 'display:none' } ) )