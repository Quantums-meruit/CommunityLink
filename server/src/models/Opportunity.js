import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({title:{type:String,required:true,maxlength:180},description:{type:String,required:true,maxlength:5000},category:{type:String,required:true},organization:String,community:{type:Schema.Types.ObjectId,ref:'Community'},createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true},deadline:Date,applicationInstructions:String,status:{type:String,enum:['draft','published','closed','removed'],default:'published'}}, {timestamps:true});
export default models.Opportunity || model("Opportunity", schema);
