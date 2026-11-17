import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({community:{type:Schema.Types.ObjectId,ref:'Community',required:true},author:{type:Schema.Types.ObjectId,ref:'User',required:true},content:{type:String,required:true,maxlength:5000},image:String,visibility:{type:String,enum:['community','public'],default:'community'},status:{type:String,enum:['published','hidden','removed'],default:'published'}}, {timestamps:true});
export default models.Post || model("Post", schema);
