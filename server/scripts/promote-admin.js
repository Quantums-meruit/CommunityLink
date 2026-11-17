import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";
const email=process.argv[2]?.toLowerCase().trim();
if(!email){console.error("Usage: npm run promote-admin -- user@example.com");process.exit(1);}
try{await mongoose.connect(process.env.MONGODB_URI||process.env.MONGO_URI);const user=await User.findOneAndUpdate({email},{globalRole:"admin"},{new:true});if(!user){console.error("No account found with that email. Register first.");process.exitCode=1;}else console.log(`Administrator role granted to ${user.email}.`);}catch(error){console.error(error.message);process.exitCode=1;}finally{await mongoose.disconnect();}
