'use server'

import { createClient } from '@/lib/supabase/supabaseServer'

export async function checkEmail(email: string): Promise<{ exists: boolean }> {
  try {
    const supabase = await createClient()
    if (!supabase) return { exists: false }

    // Supabase intentionally obfuscates whether an email exists out of the box to prevent enumeration attacks.
    // The safest non-admin way to check without accidentally creating a phantom user is `signInWithOtp`.
    // By setting `shouldCreateUser: false`, Supabase will throw a specific error if the user DOES NOT exist.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    })

    if (error) {
      if (error.message.includes('Signups not allowed for otp') || error.message.toLowerCase().includes('not found')) {
        // User does NOT exist
        return { exists: false }
      }
      
      // If we get "For security purposes, you can only request this once every 60 seconds", 
      // or other rate limits, it means the OTP email WAS actually sent, which means they exist.
    }

    // If there is no error, the OTP was successfully sent to the existing user.
    return { exists: true }
  } catch (err) {
    console.error('Error checking email:', err)
    return { exists: false }
  }
}
