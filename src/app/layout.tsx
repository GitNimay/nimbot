import type { Metadata } from 'next';
import './dashboard/styles.css';

export const metadata: Metadata = {
  title: 'Nimbot - AI Schedule & Todo Manager',
  description: 'Telegram bot for managing your schedule and todos with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
