/**
 * DEV ONLY - Fake user for bypassing authentication in development
 * This allows you to test the UI without setting up real auth
 */

export const DEV_USER = {
  id: 'dev-user-123',
  email: 'dev@hospital.local',
  role: 'admin',
  user_metadata: {
    name: 'Dev Admin',
    full_name: 'Dev Admin'
  },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

/**
 * Check if we should bypass auth in development
 */
export function shouldBypassAuth(): boolean {
  // 🔓 DEV MODE - Always return true in development
  // To disable, set NODE_ENV to 'production'
  return process.env.NODE_ENV === 'development'
  
  // Original check (commented out):
  // return (
  //   process.env.NODE_ENV === 'development' &&
  //   process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'
  // )
}
