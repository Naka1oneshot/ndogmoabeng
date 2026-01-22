import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Check if test admin creation is allowed - secure by default (disabled unless explicitly enabled)
    const allowTestAdmin = Deno.env.get('ALLOW_TEST_ADMIN')
    if (allowTestAdmin !== 'true') {
      return new Response(
        JSON.stringify({ error: 'Test admin creation is disabled. Set ALLOW_TEST_ADMIN=true to enable.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const testEmail = 'admin@test.ndogmoabeng'
    const testPassword = 'Admin123!'

    // Try to find existing user
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === testEmail)

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      console.log('Test admin user already exists:', userId)
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true
      })

      if (createError) {
        throw createError
      }

      userId = newUser.user.id
      console.log('Created test admin user:', userId)
    }

    // Assign admin role using the security definer function
    const { error: roleError } = await supabaseAdmin.rpc('assign_admin_role', {
      target_user_id: userId
    })

    if (roleError) {
      console.error('Error assigning admin role:', roleError)
      // Role might already exist, continue anyway
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test admin ready',
        email: testEmail
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
