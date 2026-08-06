/* 
  [Common] Common query arguments
*/
declare interface QICommon {
  limit?: number
  skip?: number
  sort?: string
  order?: string | number 
  search?: string
  isSnooze?: boolean
}

/*
  [Shortlink] GraphQL interface
*/
declare interface QIShortlink {
  hash: string
  location: string
  descriptor?: {
    userTag?: string
    descriptionTag: string 
  }
  owner?: string
  urlMetadata?: AnyObject
  siteTitle?: string
  siteDescription?: string
  snooze?: {
    awake: number
    description?: string
  },
  tags?: string[]
  _searchIndex?: string
}

/* 
  [Shortlink] Snooze timer params
 */
declare interface QISnoozeTimer {
  location?: string
  hash?: string
  id?: string
  standardTimer?: import('../libs/snooze.tools').StandardTimers
  customDay?: import('../libs/snooze.tools').SnoozeDay
  customTime?: import('../libs/snooze.tools').SnoozeTime
  baseDateISOString?: string
}

/* 
  [Shortlink] Persistence-independent object returned by repositories
  */
declare interface ShortlinkDocument extends QIShortlink {
  _id: string
  createdAt: string
  updatedAt: string
}

/* 

 */
declare interface QIEditableShortlinkProps {
  location?: string
  descriptor?: {
    userTag?: string
    descriptionTag: string 
  }
  owner?: string
  urlMetadata?: AnyObject
  siteTitle?: string
  siteDescription?: string
  snooze?: {
    awake: number
    description?: string
  },
  tags?: string[]
  _searchIndex?: string
  createdAt?: string
  updatedAt?: string
}

/* 
  [User] GraphQL interface for client User queries
 */
declare interface QIUser {
  name?: Maybe<string>
  userTag?: Maybe<string>
  avatar?: Maybe<string>
}

/* 
  User profile for sending to frontend
 */
declare interface UserProfile {
  email: string

  name?: Maybe<string>
  avatar?: Maybe<string>
  userTag?: Maybe<string>
  predefinedTimers?: Maybe<AnyObject[]>
}

/* 
  User params used internally
 */
declare interface UserObject extends UserProfile {
  id_token?: Maybe<string>
  access_token?: Maybe<string>
  refresh_token?: Maybe<string>
  ip?: string
}


/* 
  [User] Persistence-independent object returned by repositories
*/
declare interface UserDocument extends UserObject {
  _id: string
  createdAt: string
  updatedAt: string
}
