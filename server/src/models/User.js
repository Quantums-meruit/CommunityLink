import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const schema = new Schema({name:{type:String,required:true,trim:true,maxlength:80},email:{type:String,required:true,unique:true,lowercase:true,trim:true},password:{type:String,required:true,select:false},avatar:String,bio:{type:String,maxlength:500},location:String,globalRole:{type:String,enum:['user','admin'],default:'user'},isActive:{type:Boolean,default:true}}, {timestamps:true});
export default models.User || model("User", schema);
