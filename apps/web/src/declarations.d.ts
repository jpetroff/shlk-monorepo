declare type Maybe<T> = T | undefined | null

declare type AnyObject = { [key: string]: any }

declare type HTMLAnyInput = HTMLInputElement & HTMLTextAreaElement

declare interface ShortlinkDocument {
  _id: string
  createdAt?: string
  updatedAt?: string
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
}

declare interface QICommon {
  limit?: number
  skip?: number
  sort?: string
  order?: string | number 
  search?: string
  isSnooze?: boolean
}

declare interface QISnoozeArgs {
  location?: string
  hash?: string
  id?: string
  standardTimer?: string
  customDay?: AnyObject
  customTime?: AnyObject
  baseDateISOString?: string
}

declare interface QIUser {
  name?: string
  avatar?: string
  userTag?: string
}

declare interface User {
  _id: string
  name: string
  email: string

  avatar?: string
  userTag?: string
  predefinedTimers?: AnyObject
}


declare interface GraphQLResponse<T = any> {
  data?: T
  errors?: GraphQLError[]
  extensions?: any
  status: number
  [key: string]: any
}

declare interface ClientError extends Error {
  response: GraphQLResponse
}

declare interface GraphQLError extends Error {
    /**
   * An array of `{ line, column }` locations within the source GraphQL document
   * which correspond to this error.
   *
   * Errors during validation often contain multiple locations, for example to
   * point out two things with the same name. Errors during execution include a
   * single location, the field which produced the error.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
    readonly locations: ReadonlyArray<SourceLocation> | undefined
    /**
     * An array describing the JSON-path into the execution response which
     * corresponds to this error. Only included for errors during execution.
     *
     * Enumerable, and appears in the result of JSON.stringify().
     */
    readonly path: ReadonlyArray<string | number> | undefined
    /**
     * An array of GraphQL AST Nodes corresponding to this error.
     */
    readonly nodes: ReadonlyArray<any> | undefined
    /**
     * The source GraphQL document for the first location of this error.
     *
     * Note that if this Error represents more than one node, the source may not
     * represent nodes after the first node.
     */
    readonly source: Source | undefined
    /**
     * An array of character offsets within the source GraphQL document
     * which correspond to this error.
     */
    readonly positions: ReadonlyArray<number> | undefined
    /**
     * The original error thrown from a field resolver during execution.
     */
    readonly cause: unknown
    /**
     * Extension fields to add to the formatted error.
     */
    readonly extensions: GraphQLErrorExtensions
}

declare interface GraphQLErrorExtensions {
  [attributeName: string]: any
}

declare interface SourceLocation {
  readonly line: number
  readonly column: number
}

declare interface Source {
  body: string
  name: string
  locationOffset: Location
}