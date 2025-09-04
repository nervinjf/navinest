const handleError = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Ocurrió un error inesperado";
  const errorContent = err.errorContent || err || {};

  res.status(status).json({
    status,
    message,
    error: errorContent,
  });
};

module.exports = handleError;
