exports.successResponse = (res, data = {}, statusCode = 200) =>
  res.status(statusCode).json({ success: true, data });

exports.errorResponse = (res, message = "Something went wrong", statusCode = 500) =>
  res.status(statusCode).json({ success: false, message });