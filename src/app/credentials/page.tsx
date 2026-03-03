import type { Metadata } from 'next';
import CredentialsContent from './credentials-content';

export const metadata: Metadata = {
  title: 'Credentials',
};

export default function CredentialsPage() {
  return <CredentialsContent />;
}
