import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({opportunity:{type:Schema.Types.ObjectId,ref:'Opportunity',required:true},applicant:{type:Schema.Types.ObjectId,ref:'User',required:true},message:{type:String,maxlength:3000},status:{type:String,enum:['submitted','reviewing','accepted','rejected','withdrawn'],default:'submitted'},submittedAt:{type:Date,default:Date.now}}, {timestamps:true});
schema.index({ opportunity: 1, applicant: 1 }, { unique: true });
export default models.Application || model("Application", schema);
