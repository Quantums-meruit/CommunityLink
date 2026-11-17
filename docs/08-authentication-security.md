# Authentication and security

Passwords use bcryptjs. JWTs are issued in HTTP-only cookies. Cookies are Secure in production and use configurable SameSite behavior. The frontend sends credentials. Never store JWTs in localStorage. Configure exact frontend origins, HTTPS, a 32+ character JWT secret, rate limits and MongoDB network restrictions. Authorization is enforced by the API, not by hiding frontend controls.
