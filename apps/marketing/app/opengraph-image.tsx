import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const alt = 'DropTrack — GPS-verified leaflet distribution for Australian agents';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          backgroundColor: '#07070b',
          color: 'white',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Gradient blob backdrops */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            left: -100,
            width: 700,
            height: 700,
            borderRadius: 9999,
            background: 'radial-gradient(closest-side, rgba(99,102,241,0.45), transparent)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            right: -100,
            width: 800,
            height: 800,
            borderRadius: 9999,
            background: 'radial-gradient(closest-side, rgba(168,85,247,0.4), transparent)',
            display: 'flex',
          }}
        />

        {/* Logo wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, zIndex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 78,
              borderRadius: 32,
              background: 'linear-gradient(135deg,#6366f1 0%,#a855f7 55%,#a3e635 100%)',
              border: '5px solid white',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 18,
                height: 18,
                borderRadius: 9999,
                backgroundColor: '#a3e635',
                border: '6px solid white',
              }}
            />
          </div>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, letterSpacing: -2 }}>
            DropTrack
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, zIndex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '8px 18px',
              fontSize: 20,
              borderRadius: 9999,
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            AI-native · Australian-built · Privacy Act 1988
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1,
              maxWidth: 1000,
            }}
          >
            Verified leaflet drops,
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1,
              color: '#a3e635',
            }}
          >
            end to end.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', fontSize: 26, color: 'rgba(255,255,255,0.65)' }}>
            droptrack.com.au
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            GPS-verified · AI-reported · Built in Canberra
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
