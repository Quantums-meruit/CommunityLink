import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({community:{type:Schema.Types.ObjectId,ref:'Community',required:true},createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true},title:{type:String,required:true,maxlength:160},description:{type:String,required:true,maxlength:4000},venue:String,startsAt:{type:Date,required:true},endsAt:{type:Date,required:true},capacity:{type:Number,min:1},registeredCount:{type:Number,default:0,min:0},status:{type:String,enum:['upcoming','cancelled','completed'],default:'upcoming'}}, {timestamps:true});
schema.pre("validate", function(next){if(this.startsAt&&this.endsAt&&this.endsAt<=this.startsAt)this.invalidate("endsAt","Event end must be after its start.");next();});
export default models.Event || model("Event", schema);
