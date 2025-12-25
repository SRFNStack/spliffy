import { code, div, pre } from './fnelements.mjs'

export default (sourceCode, width = '100%') => {
  const src = pre({
    class: 'language-js',
    style: 'font-size: 14px; width: 100%; box-sizing: border-box;'
  }, code(sourceCode.trim()))

  Prism.highlightElement(src)

  return div({ style: `margin: 1.5rem 0; display: flex; flex-direction: column; width: ${width}; max-width: 94vw;` },
    src
  )
}
