/**
 * Environment-based configuration
 * Determines API endpoints based on environment
 */

type Environment = "development" | "test" | "production";

function getEnvironment(): Environment {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || "development";
  
  // Map NODE_ENV to our environment types
  if (env === "production" || env === "prod") {
    return "production";
  }
  if (env === "test" || env === "testing") {
    return "test";
  }
  return "development";
}

function getApiUrl(): string {
  const environment = getEnvironment();
  
  // Priority 1: Explicitly set API URL (highest priority - overrides everything)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Priority 2: Environment-specific URL variables
  if (environment === "production" && process.env.NEXT_PUBLIC_PROD_API_URL) {
    return process.env.NEXT_PUBLIC_PROD_API_URL;
  }
  
  if (environment === "test" && process.env.NEXT_PUBLIC_TEST_API_URL) {
    return process.env.NEXT_PUBLIC_TEST_API_URL;
  }
  
  // Priority 3: Environment-based defaults
  switch (environment) {
    case "production":
      // Production: Default to Fly.io backend
      // IMPORTANT: Set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_PROD_API_URL in Vercel
      return process.env.NEXT_PUBLIC_PROD_API_URL || "https://your-backend.fly.dev";
    
    case "test":
      // Test/staging: Default to test backend
      return process.env.NEXT_PUBLIC_TEST_API_URL || "https://your-backend-test.fly.dev";
    
    case "development":
    default:
      // Development: Use local backend
      return "http://localhost:8000";
  }
}

export const config = {
  environment: getEnvironment(),
  apiUrl: getApiUrl(),
  isDevelopment: getEnvironment() === "development",
  isProduction: getEnvironment() === "production",
  isTest: getEnvironment() === "test",
};
