
export function errorHandler(error, req, res, next) {
  // Let Express handle errors if the response has already started.
  if (res.headersSent) {
    return next(error);
  }

  // Determine the appropriate HTTP status for each error type.
  let status = error.statusCode || 500;

  // A request from an untrusted origin must receive Forbidden, not Server Error.
  if (error.message === "Origin not allowed by CORS.") {
    status = 403;
  }

  if (error.name === "MulterError") {
    // An oversized upload gets 413; other Multer errors get 400.
    status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  } else if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    status = 400;
  } else if (error.code === 11000) {
    status = 409;
  }

  // Return clear messages without exposing internal server details.
  const message =
    error.code === 11000
      ? "A record with that value already exists."
      : error.name === "ValidationError" ||
          error.name === "CastError"
        ? "Submitted data is invalid."
        : status >= 500
          ? "An unexpected server error occurred."
          : error.message;

  // Log unexpected server errors for debugging.
  if (status >= 500) {
    console.error(error);
  }

  // Keep the existing CommunityLink API error response format.
  return res.status(status).json({
    success: false,
    message,
    ...(error.details ? { details: error.details } : {}),
  });
}

