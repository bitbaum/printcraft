import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'PrintCraft — Scene Composer for Physical Art';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #141420 50%, #0a0a0f 100%)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        <div
          style={{
            fontSize: '72px',
            fontWeight: 300,
            color: '#f5f5f5',
            letterSpacing: '-2px',
          }}
        >
          PrintCraft
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 300,
            color: '#d4a853',
            letterSpacing: '0.5px',
          }}
        >
          Scene Composer for Physical Art
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 300,
            color: '#888888',
            maxWidth: '600px',
            textAlign: 'center',
            lineHeight: '1.5',
            marginTop: '8px',
          }}
        >
          Turn separate photos of real people into one unified artwork — printed on surfaces that
          matter.
        </div>
      </div>
    </div>,
    { ...size },
  );
}
