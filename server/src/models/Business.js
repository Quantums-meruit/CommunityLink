import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({name:{type:String,required:true,maxlength:160},description:{type:String,required:true,maxlength:3000},category:{type:String,required:true},location:String,contactEmail:String,phone:String,website:String,image:String,createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true},status:{type:String,enum:['pending','approved','rejected','suspended'],default:'pending'}}, {timestamps:true});
export default models.Business || model("Business", schema);
