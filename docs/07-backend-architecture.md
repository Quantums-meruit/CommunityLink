# Backend architecture

Express handles HTTP, CORS, security headers, JSON parsing, cookies, origin checks and centralized errors. Mongoose models represent the project collections. The API router applies authentication, role checks, membership/ownership checks, validation and database operations. MongoDB is accessed only by the backend.
