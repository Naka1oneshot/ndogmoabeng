import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's auth token to check permissions
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get current user
    const { data: { user: currentUser }, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !currentUser) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if current user is super_admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: isSuperAdmin } = await supabaseAdmin.rpc('is_super_admin', { 
      _user_id: currentUser.id 
    })

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Seuls les super administrateurs peuvent gérer les rôles' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { display_name, user_id, action } = await req.json()

    if (!action || !['promote', 'revoke'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Action invalide. Utilisez "promote" ou "revoke"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let targetUserId = user_id

    // If display_name provided, find user by display_name
    if (display_name && !user_id) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('display_name', display_name)
        .maybeSingle()

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: `Utilisateur "${display_name}" introuvable` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      targetUserId = profile.user_id
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Veuillez fournir un display_name ou user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if target is a super_admin (can't revoke super_admin)
    const { data: targetIsSuperAdmin } = await supabaseAdmin.rpc('is_super_admin', {
      _user_id: targetUserId
    })

    if (targetIsSuperAdmin && action === 'revoke') {
      return new Response(
        JSON.stringify({ error: 'Impossible de révoquer le rôle d\'un super administrateur' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get display name for response
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('display_name')
      .eq('user_id', targetUserId)
      .maybeSingle()

    const targetDisplayName = targetProfile?.display_name || 'Utilisateur'

    // Get current user's email for audit log
    const { data: currentUserData } = await supabaseAdmin.auth.admin.getUserById(currentUser.id)
    const currentUserEmail = currentUserData?.user?.email || 'unknown'

    // Get target user's email for audit log
    const { data: targetUserData } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
    const targetUserEmail = targetUserData?.user?.email || 'unknown'

    if (action === 'promote') {
      // Check if user already has a role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (existingRole) {
        return new Response(
          JSON.stringify({ error: `${targetDisplayName} a déjà le rôle ${existingRole.role}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Promote to admin
      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: targetUserId,
          role: 'admin'
        })

      if (insertError) {
        throw insertError
      }

      // Log the action
      await supabaseAdmin.from('admin_audit_log').insert({
        performed_by: currentUser.id,
        performed_by_email: currentUserEmail,
        target_user_id: targetUserId,
        target_user_email: targetUserEmail,
        action: 'PROMOTE_ADMIN',
        details: { display_name: targetDisplayName }
      })

      return new Response(
        JSON.stringify({ 
          success: true, 
          display_name: targetDisplayName,
          message: `${targetDisplayName} est maintenant administrateur` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'revoke') {
      // Delete admin role
      const { error: deleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId)
        .eq('role', 'admin')

      if (deleteError) {
        throw deleteError
      }

      // Log the action
      await supabaseAdmin.from('admin_audit_log').insert({
        performed_by: currentUser.id,
        performed_by_email: currentUserEmail,
        target_user_id: targetUserId,
        target_user_email: targetUserEmail,
        action: 'REVOKE_ADMIN',
        details: { display_name: targetDisplayName }
      })

      return new Response(
        JSON.stringify({ 
          success: true, 
          display_name: targetDisplayName,
          message: `${targetDisplayName} n'est plus administrateur` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Action non reconnue' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
