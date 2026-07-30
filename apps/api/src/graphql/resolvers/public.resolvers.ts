 
import { 
  createShortlink, 
  createShortlinkDescriptor,
  getShortlink,
  ShortlinkPublicFields
} from '../../libs/shortlink.queries'
import { GraphQLError } from 'graphql'
import * as _ from 'underscore'
import { resolveError } from '../extends'
import { authUserId } from '../../libs/auth.helpers'

export default {
  Mutation: {
    createShortlink: async ( parent : any, args : { location: string }, context: any) => {
      try {
        const userId = authUserId(context?.req)
        return await createShortlink(args.location, userId)
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
  
    createDescriptiveShortlink: async ( parent : any, args: {location: string, userTag?: string, descriptionTag: string, hash?: string }, context: any) => {
      try {
        const userId = authUserId(context?.req)
        return await createShortlinkDescriptor(
          _.extendOwn(
            {userId},
            args
          )
        )
      } catch(error : any) {
        if(error instanceof GraphQLError) { throw error } 
        else {
          throw new GraphQLError(
            error.message || String(error), 
            { extensions: error.meta || { code: 'UNKNOWN_ERROR' } }
          )
        }
      }
    }
  },

  Query: {
    getShortlinkByHash: async ( parent : any, args: { hash: string }, context: any ) => {
      try {
        const shortlink = await getShortlink(args)
        if(context.req?.session?.userId == shortlink?.owner) {
          return shortlink?.toObject()
        }

        if (shortlink) {
          return _.pick(shortlink.toObject(), ShortlinkPublicFields)
        } 
          
        return null
      } catch(error : any) {
        return resolveError(error)
      }
    },
  
    getShortlinkByDescription: async ( parent : any, args: { userTag?: string, descriptionTag: string }, context: any ) => {
      try {
        const shortlink = await getShortlink(args)
        if(context.req?.session?.userId == shortlink?.owner) {
          return shortlink?.toObject()
        }

        if (shortlink) {
          return _.pick(shortlink.toObject(), ShortlinkPublicFields)
        } 
          
        return null
      } catch(error : any) {
        return resolveError(error)
      }
    }
  }
}