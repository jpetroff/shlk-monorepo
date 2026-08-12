import constants from './constants'
import config from './config'

class ClipboardTools {
  readonly enabled : boolean

  constructor() {
    this.enabled = (
      typeof navigator.clipboard?.writeText === 'function' &&
      typeof navigator.clipboard?.readText === 'function'
    )
  }

  async paste() : Promise<string | void> {
    if(this.enabled) {
      const clipText = await navigator.clipboard.readText()
      return clipText
    }
    return void 0
  }

  copy(clipText: string) {
    if(this.enabled && clipText) {
      navigator.clipboard.writeText(clipText)
    } 
  }
}

export default new ClipboardTools()