const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Facility Database Upload API',
      version: '1.1.0',
      description: 'Secure API for managing PostgreSQL database uploads for multiple facilities with role-based access control',
      contact: {
        name: 'API Support'
      },
      license: {
        name: 'ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server'
      },
      {
        url: 'https://api.example.com',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie authentication'
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'csrf-token',
          description: 'CSRF token for POST/PUT/DELETE requests'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID'
            },
            username: {
              type: 'string',
              description: 'Username (3-32 chars, alphanumeric + underscore)',
              pattern: '^[a-zA-Z0-9_]{3,32}$'
            },
            password: {
              type: 'string',
              description: 'Password (8+ chars with uppercase, lowercase, number)',
              writeOnly: true
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email'
            },
            role: {
              type: 'string',
              enum: ['admin', 'uploader'],
              description: 'User role'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          },
          required: ['username', 'password', 'role']
        },
        Facility: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Facility ID'
            },
            facility_name: {
              type: 'string',
              description: 'Facility name'
            },
            facility_code: {
              type: 'string',
              description: 'Facility code (3-20 chars: uppercase, numbers, underscore, hyphen)',
              pattern: '^[A-Z0-9_-]{3,20}$'
            },
            description: {
              type: 'string',
              description: 'Facility description'
            },
            file_path: {
              type: 'string',
              description: 'Path to uploaded PostgreSQL dump file'
            },
            uploaded_at: {
              type: 'string',
              format: 'date-time',
              description: 'Upload timestamp'
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          },
          required: ['facility_name', 'facility_code']
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        }
      }
    },
    security: [
      {
        sessionAuth: []
      }
    ]
  },
  apis: [
    './server.js',
    './routes/*.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;
