/**
 * DEV ONLY - Banner to show when authentication is bypassed
 */

export function DevAuthBanner() {
  // Only show in development when auth is bypassed
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== 'true'
  ) {
    return null
  }

  return (
    <div className="bg-yellow-500 px-4 py-2 text-center text-sm font-medium text-black">
      🔓 DEV MODE: Authentication bypassed - Logged in as{' '}
      <span className="font-bold">dev@hospital.local</span>
      {' '}(To disable, set NEXT_PUBLIC_DEV_BYPASS_AUTH=false in .env.local)
    </div>
  )
}
