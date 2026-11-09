
export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

export function errorHandler(err, req, res, next) {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.values(err.errors).map((item) => item.message)
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid record ID"
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A record with this value already exists"
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.statusCode ? err.message : "Internal server error"
  });
}