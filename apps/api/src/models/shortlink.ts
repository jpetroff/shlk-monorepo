import mongoose, { Schema } from 'mongoose'
import uniqueValidator from 'mongoose-unique-validator'


export type ShortlinkModel = typeof mongoose.Model<ShortlinkDocument>

const shortlinkSchema = new Schema<ShortlinkDocument, ShortlinkModel>(
  {
    hash: {
      type: String,
      required: true,
      unique: true,
      immutable: true
    },

    location: {
      type: String,
      required: true,
    },

    descriptor: {
      userTag: { type: String },
      descriptionTag: { type: String }
    },

    owner: {
      type: Schema.Types.ObjectId,
      index: true,
      required: false,
      immutable: true
    },

    urlMetadata: {
      type: Schema.Types.Mixed
    },

    siteTitle: {
      type: String
    },

    siteDescription: {
      type: String
    },

    snooze: {
      awake: Number,
      description: String
    },

    tags: {
      type: [String]
    },

    _searchIndex: {
      type: String
    }

  },
  { timestamps: true }
)

shortlinkSchema.plugin(uniqueValidator)

export default mongoose.model<ShortlinkDocument, ShortlinkModel>("Shortlink", shortlinkSchema)