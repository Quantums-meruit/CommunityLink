import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true},community:{type:Schema.Types.ObjectId,ref:'Community',required:true},role:{type:String,enum:['owner','moderator','member'],default:'member'},status:{type:String,enum:['pending','active','rejected','banned'],default:'active'},joinedAt:Date}, {timestamps:true});
schema.index({ user: 1, community: 1 }, { unique: true });
export default models.Membership || model("Membership", schema);
