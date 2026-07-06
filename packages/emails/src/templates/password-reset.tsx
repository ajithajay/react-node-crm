import { Link, Text } from '@react-email/components';
import { EmailLayout } from './layout.js';

export interface PasswordResetProps {
  resetUrl: string;
}

export function PasswordResetTemplate({ resetUrl }: PasswordResetProps) {
  return (
    <EmailLayout preview="Reset your Saasly CRM password" heading="Reset your password">
      <Text>Click the link below to choose a new password. This link expires soon.</Text>
      <Link href={resetUrl}>{resetUrl}</Link>
      <Text style={{ color: '#64748b', fontSize: '13px' }}>
        If you didn't request a password reset, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
