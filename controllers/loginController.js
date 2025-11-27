const passport = require('passport');

// GET /login - Display login form
exports.getLogin = (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/');
  } else {
    res.render('login');
  }
};

// POST /login - Handle login submission
exports.postLogin = passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
});

// GET /logout - Handle logout
exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.redirect('/login');
  });
};
