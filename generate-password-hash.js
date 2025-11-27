#!/usr/bin/env node

/**
 * Generate bcrypt hash for password seeding
 * Run: node generate-password-hash.js <password>
 */

const bcrypt = require('bcrypt');

const password = process.argv[2] || 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nUse this in seed-users.sql:');
  console.log(`INSERT INTO users (username, password, email, created_at) VALUES`);
  console.log(`('admin', '${hash}', 'admin@facilities.local', NOW());`);
  process.exit(0);
});
