// src/app/api/settings/bank/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const marca = request.nextUrl.searchParams.get('marca') || 'AREPA'
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('app_settings')
    .select('banco_nombre, banco_cuenta, banco_titular, banco_ruc, banco_instrucciones, metodo_tarjeta_activo, metodo_transferencia_activo, horario_apertura, horario_cierre, dias_abierto, envio_gratis_umbral, envio_costo')
    .eq('marca', marca)
    .single()

  if (!data) return NextResponse.json({ bankInfo: null })

  // Check if store is open
  const now = new Date()
  const dayNames = ['dom','lun','mar','mie','jue','vie','sab']
  const currentDay = dayNames[now.getDay()]
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const isOpen = (data.dias_abierto || []).includes(currentDay)
    && currentTime >= data.horario_apertura
    && currentTime <= data.horario_cierre

  return NextResponse.json({
    bankInfo: {
      banco_nombre: data.banco_nombre,
      banco_cuenta: data.banco_cuenta,
      banco_titular: data.banco_titular,
      banco_ruc: data.banco_ruc,
      banco_instrucciones: data.banco_instrucciones,
    },
    metodoPagoActivo: {
      tarjeta: data.metodo_tarjeta_activo,
      transferencia: data.metodo_transferencia_activo,
    },
    isOpen,
    envioGratisUmbral: data.envio_gratis_umbral,
    envioCosto: data.envio_costo,
  })
}
