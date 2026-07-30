import * as _ from 'underscore'

export type GracefulErrorType = {
  message: string
  code?: string
  source?: AnyObject
}

class GracefulError {
  constructor() {}

  /* 

   */
  public processGQLResponse(response: GraphQLResponse) : GracefulErrorType[] {
    const errorsResponseArray = response?.errors
    const result : GracefulErrorType[] = []
    if(errorsResponseArray && errorsResponseArray.length > 0) {
      _.each(errorsResponseArray, (item, index) => {
        result.push( {
          message: item.message,
          code: item.extensions?.code ? String(item.extensions.code) : undefined,
          source: item || undefined
        } )
      })
    }
    return result
  }
}

export default new GracefulError()