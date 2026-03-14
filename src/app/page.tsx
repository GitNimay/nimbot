import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F7F5F2',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: '#D4603A',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: '36px',
          color: 'white',
        }}>
          N
        </div>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: '48px',
          fontWeight: '600',
          marginBottom: '12px',
          letterSpacing: '-1px',
        }}>
          Nimbot
        </h1>
        <p style={{
          color: '#6B6560',
          fontSize: '18px',
          marginBottom: '40px',
        }}>
          AI Schedule & Todo Manager
        </p>
        <Link href="/dashboard" style={{
          display: 'inline-block',
          padding: '16px 32px',
          background: '#1A1918',
          color: 'white',
          borderRadius: '12px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '16px',
        }}>
          Open Dashboard →
        </Link>
      </div>
    </div>
  );
}
