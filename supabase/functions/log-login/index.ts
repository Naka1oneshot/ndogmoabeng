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
    
    // Get auth header to identify user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to get user info
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: { Authorization: authHeader }
      }
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body with device info
    const body = await req.json().catch(() => ({}))
    const userAgent = req.headers.get('user-agent') || body.userAgent || ''
    
    // Parse user agent to extract device info
    const deviceInfo = parseUserAgent(userAgent)
    
    // Get IP from headers (Cloudflare/proxy headers)
    const ipAddress = req.headers.get('cf-connecting-ip') || 
                      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') ||
                      'Unknown'

    // Create service client for insert
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Insert login record
    const { error: insertError } = await supabaseAdmin
      .from('login_history')
      .insert({
        user_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent.substring(0, 500), // Limit length
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os
      })

    if (insertError) {
      console.error('Error inserting login history:', insertError)
      // Don't fail the request, just log the error
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function parseUserAgent(userAgent: string): { deviceType: string; browser: string; os: string } {
  let deviceType = 'Desktop'
  let browser = 'Unknown'
  let os = 'Unknown'

  // Detect device type
  if (/mobile/i.test(userAgent)) {
    deviceType = 'Mobile'
  } else if (/tablet|ipad/i.test(userAgent)) {
    deviceType = 'Tablet'
  }

  // Detect browser
  if (/firefox/i.test(userAgent)) {
    browser = 'Firefox'
  } else if (/edg/i.test(userAgent)) {
    browser = 'Edge'
  } else if (/chrome/i.test(userAgent)) {
    browser = 'Chrome'
  } else if (/safari/i.test(userAgent)) {
    browser = 'Safari'
  } else if (/opera|opr/i.test(userAgent)) {
    browser = 'Opera'
  }

  // Detect OS
  if (/windows/i.test(userAgent)) {
    os = 'Windows'
  } else if (/macintosh|mac os/i.test(userAgent)) {
    os = 'macOS'
  } else if (/linux/i.test(userAgent)) {
    os = 'Linux'
  } else if (/android/i.test(userAgent)) {
    os = 'Android'
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    os = 'iOS'
  }

  return { deviceType, browser, os }
}
