// Check if user is authenticated and has admin role
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
};

// Check if user is authenticated (any role)
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    next();
  } else {
    // For API requests, return 401 instead of redirecting
    // This prevents HTTPS redirect loops on localhost
    if (req.path.startsWith('/api/')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    } else {
      // For page requests, redirect to login
      res.redirect('/login');
    }
  }
};

module.exports = {
  isAdmin,
  isAuthenticated
};
