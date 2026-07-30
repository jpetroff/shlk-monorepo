import mongoose from 'mongoose'
import uniqueValidator from 'mongoose-unique-validator'


export type UserModel = typeof mongoose.Model<UserDocument>

const Schema = mongoose.Schema

const userSchema = new Schema<UserDocument, UserModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: true,
    },

    avatar: {
      type: String
    },

    userTag: {
      type: String
    },

    id_token: {
      type: String,
      unique: true
    },

    access_token: {
      type: String,
      unique: true
    },

    refresh_token: {
      type: String,
      unique: true
    },

    ip: {
      type: String
    },
  },
  { timestamps: true }
)

userSchema.plugin(uniqueValidator)

export default mongoose.model<UserDocument, UserModel>("User", userSchema)