export const requireAdmin=(req,res,next)=>req.user?.globalRole==="admin"?next():res.status(403).json({success:false,message:"Administrator access required."});
