const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const connectionLogSchema = new Schema(
  {
    event: {
      type: String,
      enum: ['LOGIN', 'LOGOUT'],
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: {
      type: String,
    },
    role: {
      type: String,
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ConnectionLog', connectionLogSchema);
