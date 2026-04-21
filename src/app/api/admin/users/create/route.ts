import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    // Verify requesting user is PRINCIPAL admin
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user } } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: requestingAdmin } = await supabase
      .from('admin_users')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (requestingAdmin?.rol !== 'PRINCIPAL') {
      return NextResponse.json({ error: 'Solo el admin principal puede crear usuarios' }, { status: 403 })
    }

    const { email, nombre, password, rol } = await request.json()

    // Create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // Insert into admin_users table
    const { error: insertError } = await supabase.from('admin_users').insert({
      id: newUser.user.id,
      nombre,
      rol,
      activo: true,
    })

    if (insertError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId: newUser.user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
