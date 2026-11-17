# Integration guide

The shared API base is `/api/v1`; frontend Axios uses `VITE_API_URL` and `withCredentials:true`. Authentication middleware attaches `req.user` with `id` and `globalRole`. Global roles (`user`, `admin`) are distinct from community roles (`owner`, `moderator`, `member`). Coordinate field names, statuses, endpoint paths and shared files before merging module work.
