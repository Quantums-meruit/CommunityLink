import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({recipient:{type:Schema.Types.ObjectId,ref:'User',required:true},type:{type:String,required:true},message:{type:String,required:true,maxlength:500},resourceType:String,resourceId:Schema.Types.ObjectId,isRead:{type:Boolean,default:false}}, {timestamps:true});
export default models.Notification || model("Notification", schema);
