import { code, div, pre } from './fnelements.mjs'

export default (sourceCode, width = '100%') => {
  const src = pre({
    class: 'language-js',
    style: 'font-size: 14px; width: 100%; box-sizing: border-box; box-shadow: 0px 0px 3px 0px rgba(0,0,0,0.75);'
  }, code(sourceCode.trim()))

  Prism.highlightElement(src)

  return div({ style: `margin: auto; display: flex; flex-direction: column; padding-bottom: 15px;width: ${width}; max-width: 94vw;` },
    src
  )
}
