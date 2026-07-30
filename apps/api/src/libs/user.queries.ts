 
import User from '../models/user'
import _ from 'underscore'
import { checkBanlist } from './ban.queries'

export const UserProfileFields : (keyof UserProfile)[] = [ 'email', 'name', 'avatar', 'userTag' ]
export const UserObjectFields : (keyof UserObject)[] = [...UserProfileFields, 'id_token', 'access_token', 'refresh_token', 'ip']

export async function createOrUpdateUser( args: UserObject ) : Promise<ResultDoc<UserDocument> | null> {
  if(_.isEmpty(args.refresh_token)) args = _.omit(args, 'refresh_token')
  if(_.isEmpty(args.name)) args.name = args.email

  await checkBanlist(args.email, 'user')

  const newParams = _.pick(args, (value, key) => {
    return  UserObjectFields.indexOf(key as (keyof UserObject)) != -1 &&
            !_.isEmpty(value)
  })

  const user = await User.findOneAndUpdate(
    { email: args.email},
    newParams,
    {upsert: true, new: true}
  )

  /* Handle defaults on creation to only modify missing default fields */
  if(!user.userTag) {
    user.userTag = String(user.name).toLowerCase()
    await user.save()
  }

  return user
}

export async function updateUserById(id: string, params: QIUser) : Promise<ResultDoc<UserDocument> | null> {
  const newParams = _.pick(params, (value, key) => {
    return  UserProfileFields.indexOf(key as (keyof UserProfile)) != -1 &&
            !_.isEmpty(value)
  })
  const result = await User.findByIdAndUpdate(id, newParams, {new: true})
  return result
}

export async function getUser(id: string) : Promise<ResultDoc<UserDocument> | null> {
  const loggedUser = await User.findById(id)
  return loggedUser
}