import { config } from 'dotenv';
import { z } from 'zod';

// Load .env.local first, then .env
config({ path: '.env.local' });
config({ path: '.env' });

/**
 * Environment variable schema with validation
 * Validates all required environment variables for New Mystica backend
 */
const EnvSchema = z.object({
  // Supabase Configuration
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Cloudflare R2 Configuration
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'CLOUDFLARE_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().default('mystica-assets'),
  R2_PUBLIC_URL: z.string().url('R2_PUBLIC_URL must be a valid URL'),

  // AI Services Configuration
  REPLICATE_API_TOKEN: z.string().min(1, 'REPLICATE_API_TOKEN is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // Optional AI Services
  ELEVENLABS_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  HF_TOKEN: z.string().optional(),
  SERP_API_KEY: z.string().optional(),

  // Server Configuration
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security').default('your-super-secret-jwt-key-for-anonymous-users-must-be-32-chars-minimum'),

  // Database Configuration
  DATABASE_URL: z.string().url().optional(), // For direct PostgreSQL if needed
  REDIS_URL: z.string().url().optional(), // For Redis session storage, defaults to redis://localhost:6379

  // Development-only authentication bypass
  DEV_BYPASS_KEY: z.string().optional(), // Only used in development for manual testing
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parse and validate environment variables
 * Throws detailed error if validation fails
 */
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const errorDetails = parsed.error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    received: issue.code === 'invalid_type' ? typeof process.env[issue.path[0] as string] : 'unknown'
  }));

  console.error('❌ Environment validation failed:');
  console.error('Missing or invalid environment variables:');
  errorDetails.forEach(({ field, message, received }) => {
    console.error(`  • ${field}: ${message} (received: ${received})`);
  });
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  console.error('See .env.example for reference.');

  throw new Error('Invalid environment configuration');
}

/**
 * Validated and typed environment configuration
 * Safe to use throughout the application
 */
export const env = parsed.data;

// Log successful validation in development
if (env.NODE_ENV === 'development') {
  console.log('✅ Environment variables validated successfully');
}