import mongoose, { Schema } from 'mongoose'
import uniqueValidator from 'mongoose-unique-validator'

export type BanType = 'IP' | 'user' | 'location'

export interface BanItem {
  value: string
  type: BanType
}

export interface BanDocument extends BanItem {
  _id: ObjectId
  createdAt?: string
  updatedAt?: string
}

export type BanModel = typeof mongoose.Model<BanDocument>

const banlistSchema = new Schema<BanDocument, BanModel>(
  {
    value: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
)

banlistSchema.plugin(uniqueValidator)

export default mongoose.model<BanDocument, BanModel>('Banlist', banlistSchema)
