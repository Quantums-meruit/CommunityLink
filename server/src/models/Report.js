import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({reporter:{type:Schema.Types.ObjectId,ref:'User',required:true},targetType:{type:String,enum:['user','post','comment','business','opportunity'],required:true},targetId:{type:Schema.Types.ObjectId,required:true},reason:{type:String,required:true,maxlength:120},details:{type:String,maxlength:2000},status:{type:String,enum:['open','reviewing','resolved','dismissed'],default:'open'},reviewedBy:{type:Schema.Types.ObjectId,ref:'User'},resolution:String}, {timestamps:true});
export default models.Report || model("Report", schema);
