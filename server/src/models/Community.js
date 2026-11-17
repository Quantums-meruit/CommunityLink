import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({name:{type:String,required:true,trim:true,maxlength:100},slug:{type:String,required:true,unique:true,lowercase:true},description:{type:String,required:true,maxlength:2000},category:{type:String,required:true},image:String,visibility:{type:String,enum:['public','private'],default:'public'},owner:{type:Schema.Types.ObjectId,ref:'User',required:true},status:{type:String,enum:['active','suspended'],default:'active'}}, {timestamps:true});
export default models.Community || model("Community", schema);
