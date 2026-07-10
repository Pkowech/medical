// src/config/swagger.config.ts
import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Medical Learning Platform API')
  .setDescription('REST API for medical education and training platform')
  .setVersion('1.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    },
    'JWT-auth',
  )
  .addTag('Authentication', 'User authentication and authorization')
  .addTag('Users', 'User management')
  .addTag('Courses', 'Course and content management')
  .addTag('Assessments', 'Quizzes, tests, and evaluations')
  .addTag('Learning', 'Learning paths and progress')
  .addTag('Analytics', 'Learning analytics and reporting')
  .addTag('Communication', 'Chat and notifications')
  .addTag('Admin', 'Administrative functions')
  .addServer('http://localhost:3000', 'Development server')
  .addServer('https://api.medicalapp.com', 'Production server')
  .build();
