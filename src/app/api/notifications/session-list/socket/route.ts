import { NextResponse } from 'next/server';
import {
  buildSessionListNotificationWsUrl,
  ensureSessionNotificationServer,
} from '@/lib/sessionNotificationServer';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { wsBaseUrl } = await ensureSessionNotificationServer();
    const wsUrl = buildSessionListNotificationWsUrl(wsBaseUrl);
    return NextResponse.json({ wsUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initialize session list socket';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
