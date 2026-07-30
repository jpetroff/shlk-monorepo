import { getUser, createOrUpdateUser, UserProfileFields, updateUserById } from '../../libs/user.queries'
import { queryShortlinks, setAwakeTimer, queryPredefinedTimers, queryAndDeleteShortlinkSnoozeTimer, deleteShortlink, updateShortlink } from '../../libs/shortlink.queries'
import { authUserId } from '../../libs/auth.helpers'
import { GraphQLError } from 'graphql'
import * as _ from 'underscore'
import { resolveError } from '../extends'

export default {
  Query: {
    getLoggedInUser: async ( parent: any, args: void, context: any) : Promise<UserProfile | null> => {
      try {
        const userId = context?.req?.session?.userId

        const loggedUser : Maybe<ResultDoc<UserDocument>> = await getUser(userId)
        if(!loggedUser) return null

        const loggedProfile : UserProfile = _.pick(loggedUser.toObject(), UserProfileFields)
        loggedProfile.predefinedTimers = await queryPredefinedTimers(userId)
        return loggedProfile

      } catch(error : any) {
        if(error instanceof GraphQLError) { throw error } 
        else {
          throw new GraphQLError(
            error.message || String(error), 
            { extensions: error.meta || { code: 'UNKNOWN_ERROR' } }
          )
        }
      }
    },

    getUserShortlinks: async ( parent: any, { args }: Args<QICommon>, context: any) : Promise<ShortlinkDocument[]> => {
      try {
        const userId = authUserId(context?.req)
        const queryArgs = _.extendOwn({ userId: userId }, args)
        const shortlinkList = await queryShortlinks(queryArgs)
        return shortlinkList
      } catch(error : any) {
        throw resolveError(error)
      }
    },

    getPredefinedTimers: async (_: any, __: any, context: any) : Promise<{label: string, value: string}[]> => {
      const userId = context?.req?.session?.userId
      return queryPredefinedTimers(userId)
    }
  },

  Mutation: {
    updateLoggedInUser: async (parent: any, { args }: Args<QIUser>, context: any) : Promise<UserProfile | null> => {
      try {
        const userId = authUserId(context?.req)
        const result = await updateUserById(userId, args)
        return result?.toObject() || null
      } catch(error: any) {
        throw resolveError(error)
      }
    },

    createOrUpdateShortlinkTimer: async (parent: any, { args }: Args<QISnoozeTimer>, context: any) : Promise<ShortlinkDocument | null> => {
      const userId = context?.req?.session?.userId
      const shortlink = await setAwakeTimer( {
        userId: userId,
        ...args
      })
      if(!shortlink) return null
      return shortlink.toObject()
    },

    deleteShortlinkSnoozeTimer: async (parent: any, { ids } : { ids: string[] }, context: any) : Promise<ShortlinkDocument[]> => {
      try {
        const userId = authUserId(context?.req)
        const result : ShortlinkDocument[] = []
        for(let i = 0; i < ids.length; i++) {
          const shortlink = await queryAndDeleteShortlinkSnoozeTimer(ids[i])
          if(shortlink) result.push(shortlink.toObject())
        }
        return result
      } catch(error: any) {
        throw resolveError(error)
      }
    },

    deleteShortlink: async (parent: any, { id } : {id: string}, context: any) : Promise<ShortlinkDocument | null> => {
      try {
        const userId = authUserId(context?.req)
        const shortlink = await deleteShortlink(id)
        if(!shortlink) return null
        return shortlink.toObject()
      } catch(error) {
        throw resolveError(error)
      }
    },

    updateShortlink: async (parent: any, { id, shortlink } : {id: string, shortlink: QIEditableShortlinkProps}, context: any) : Promise<ShortlinkDocument | null> => {
      try {
        const userId = authUserId(context?.req)
        const newShortlink = await updateShortlink(userId, {id, shortlink})
        if(!newShortlink) return null
        return newShortlink.toObject()
      } catch(error) {
        throw resolveError(error)
      }
    }
  }
}