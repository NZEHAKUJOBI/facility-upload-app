/**
 * User Controller Tests
 * Tests for user management endpoints
 */

const userController = require('../../controllers/userController');
const pool = require('../../db');

// Mock the database pool
jest.mock('../../db', () => ({
  query: jest.fn()
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password')
}));

describe('User Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { id: 1, username: 'admin', role: 'admin' },
        { id: 2, username: 'user', role: 'uploader' }
      ];
      pool.query.mockResolvedValueOnce({ rows: mockUsers });

      await userController.getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUsers
      });
    });

    it('should handle database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB Error'));

      await userController.getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'DB Error'
      });
    });
  });

  describe('createUser', () => {
    it('should create a new user with valid input', async () => {
      req.body = {
        username: 'john_doe',
        password: 'SecurePass123',
        email: 'john@example.com',
        role: 'uploader'
      };

      const newUser = {
        id: 3,
        username: 'john_doe',
        email: 'john@example.com',
        role: 'uploader'
      };

      pool.query.mockResolvedValueOnce({ rows: [newUser] });

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User created successfully',
        data: newUser
      });
    });

    it('should reject invalid username', async () => {
      req.body = {
        username: 'ab', // Too short
        password: 'SecurePass123',
        role: 'uploader'
      };

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('3')
        })
      );
    });

    it('should reject weak password', async () => {
      req.body = {
        username: 'john_doe',
        password: 'weak',
        role: 'uploader'
      };

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('password')
        })
      );
    });

    it('should reject invalid email', async () => {
      req.body = {
        username: 'john_doe',
        password: 'SecurePass123',
        email: 'invalid-email',
        role: 'uploader'
      };

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('email')
        })
      );
    });

    it('should reject invalid role', async () => {
      req.body = {
        username: 'john_doe',
        password: 'SecurePass123',
        role: 'superadmin'
      };

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('role')
        })
      );
    });

    it('should handle username already exists error', async () => {
      req.body = {
        username: 'john_doe',
        password: 'SecurePass123',
        role: 'uploader'
      };

      const error = new Error('Unique violation');
      error.code = '23505';
      pool.query.mockRejectedValueOnce(error);

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Username already exists'
      });
    });
  });

  describe('updateUser', () => {
    it('should update user with valid input', async () => {
      req.params.id = 1;
      req.body = {
        email: 'newemail@example.com',
        role: 'admin'
      };

      const updatedUser = {
        id: 1,
        username: 'john_doe',
        email: 'newemail@example.com',
        role: 'admin'
      };

      pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

      await userController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });
    });

    it('should reject invalid email on update', async () => {
      req.params.id = 1;
      req.body = {
        email: 'invalid-email'
      };

      await userController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('email')
        })
      );
    });

    it('should return 404 if user not found', async () => {
      req.params.id = 999;
      req.body = { email: 'test@example.com' };

      pool.query.mockResolvedValueOnce({ rows: [] });

      await userController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid input', async () => {
      req.params.id = 1;
      req.body = {
        newPassword: 'NewSecurePass123'
      };

      const user = {
        id: 1,
        username: 'john_doe',
        role: 'uploader'
      };

      pool.query.mockResolvedValueOnce({ rows: [user] });

      await userController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully',
        data: user
      });
    });

    it('should reject weak password', async () => {
      req.params.id = 1;
      req.body = {
        newPassword: 'weak'
      };

      await userController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('password')
        })
      );
    });

    it('should return 404 if user not found', async () => {
      req.params.id = 999;
      req.body = {
        newPassword: 'NewSecurePass123'
      };

      pool.query.mockResolvedValueOnce({ rows: [] });

      await userController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      req.params.id = 2;

      // Mock admin check
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: 2 }] }) // admin count
        .mockResolvedValueOnce({ rows: [{ role: 'uploader' }] }) // user role
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }); // delete result

      await userController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully'
      });
    });

    it('should prevent deletion of last admin', async () => {
      req.params.id = 1;

      // Mock admin check - only 1 admin and user is admin
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // admin count
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // user role

      await userController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot delete the last admin user'
      });
    });

    it('should return 404 if user not found', async () => {
      req.params.id = 999;

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: 2 }] }) // admin count
        .mockResolvedValueOnce({ rows: [] }); // user not found

      await userController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
