export default `
  input QIUserUpdate {
    name: String
    avatar: String
    userTag: String
  }

  input QIUserShortlinks {
    limit: Int
    skip: Int
    sort: String
    order: String
    search: String
    isSnooze: Boolean
  }

  input QISnoozeArgs {
    location: String
    hash: String
    id: String
    standardTimer: String
    customDay: Mixed
    customTime: Mixed
    baseDateISOString: String
  }

  type User {
    _id: ID!
    email: String!

    name: String!
    avatar: String
    userTag: String

    createdAt: String
    updatedAt: String

    predefinedTimers: [Mixed]
  }

  type Query {
    getLoggedInUser: User
    getUserShortlinks(args: QIUserShortlinks): [Shortlink]
    getPredefinedTimers: [Mixed]
  }
  
  type Mutation {
    updateLoggedInUser(args: QIUserUpdate): User
    createOrUpdateShortlinkTimer(args: QISnoozeArgs) : Shortlink
    deleteShortlinkSnoozeTimer(ids: [String]) : [Shortlink]
    deleteShortlink(id: String!) : Shortlink
  }

  schema {
    query: Query
    mutation: Mutation
  }
`