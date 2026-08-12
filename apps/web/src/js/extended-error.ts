import AppError from './app-error'

export type GracefulErrorType = AppError

class GracefulError {
  constructor() {}

  /* 

   */
  public processGQLResponse(response?: GraphQLResponse) : GracefulErrorType[] {
    const errorsResponseArray = response?.errors
    const result : GracefulErrorType[] = []
    if(errorsResponseArray && errorsResponseArray.length > 0) {
      errorsResponseArray.forEach((item) => {
        result.push(new AppError(item.message, {
          code: item.extensions?.code ? String(item.extensions.code) : undefined,
          source: item || undefined
        }))
      })
    }
    return result
  }
}

export default new GracefulError()