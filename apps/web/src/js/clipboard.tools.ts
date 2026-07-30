import _ from 'underscore'
import constants from './constants'
import config from './config'

class ClipboardTools {
  readonly enabled : boolean

  constructor() {
    this.enabled = (
      _.isFunction(navigator.clipboard.writeText) &&
      _.isFunction(navigator.clipboard.readText)
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