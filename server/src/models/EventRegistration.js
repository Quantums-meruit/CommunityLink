import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({event:{type:Schema.Types.ObjectId,ref:'Event',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},status:{type:String,enum:['registered','cancelled','attended'],default:'registered'},registeredAt:{type:Date,default:Date.now}}, {timestamps:true});
schema.index({ event: 1, user: 1 }, { unique: true });
export default models.EventRegistration || model("EventRegistration", schema);
