import { ExtError } from "./utils"

export function authUserId(req: Maybe<Express.Request>) : string {
  if(req?.session?.userId) {
    return req.session.userId
  } else {
    throw new ExtError(
      `Please, log in with Google account to use the app`,
      { code: 'FORBIDDEN' }
    )
  }
}