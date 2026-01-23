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
    // Cette fonction requiert les credentials via le body de la requête
    // Elle est sécurisée par le fait qu'elle vérifie si un super_admin existe déjà
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Get credentials from request body - NEVER hardcode credentials
    const { email, password } = await req.json()
    
    if (!email || !password) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Email and password are required in the request body' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid email format' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate password strength (minimum 8 chars, at least 1 number, 1 uppercase)
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Password must be at least 8 characters with 1 uppercase letter and 1 number' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Vérifier si un super_admin existe déjà
    const { data: existingSuperAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('role', 'super_admin')
      .limit(1)
      .single()

    if (existingSuperAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Un super admin existe déjà. Cette fonction ne peut être utilisée qu\'une seule fois.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Chercher si l'utilisateur existe déjà
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      console.log('Super admin user already exists:', userId)
      
      // Mettre à jour le mot de passe si l'utilisateur existe
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true
      })
    } else {
      // Créer le nouvel utilisateur
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
      })

      if (createError) {
        throw createError
      }

      userId = newUser.user.id
      console.log('Created super admin user:', userId)
    }

    // Supprimer tout rôle existant pour cet utilisateur
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    // Assigner le rôle super_admin
    const { error: roleError } = await supabaseAdmin.rpc('assign_super_admin_role', {
      target_user_id: userId
    })

    if (roleError) {
      console.error('Error assigning super_admin role:', roleError)
      throw roleError
    }

    // Créer ou mettre à jour le profil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        display_name: 'Super Admin',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (profileError) {
      console.error('Error creating profile:', profileError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Compte Super Admin créé avec succès',
        // Don't return the email in response for security
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
