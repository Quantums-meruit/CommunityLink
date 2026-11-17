# API documentation

Base URL: `/api/v1`. Responses use `{ success, data }` on success and `{ success: false, message }` on failure. Collection endpoints accept `page` and `limit` where applicable. Authentication endpoints: POST `/auth/register`, POST `/auth/login`, POST `/auth/logout`, GET `/auth/me`. See the project specification for the full endpoint and permission contract.
