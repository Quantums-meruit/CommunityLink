import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({post:{type:Schema.Types.ObjectId,ref:'Post',required:true},author:{type:Schema.Types.ObjectId,ref:'User',required:true},content:{type:String,required:true,maxlength:2000},status:{type:String,enum:['published','hidden','removed'],default:'published'}}, {timestamps:true});
export default models.Comment || model("Comment", schema);
