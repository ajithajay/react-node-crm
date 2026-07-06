import { Link, Text } from '@react-email/components';
import { EmailLayout } from './layout.js';

export interface VerifyEmailProps {
  verifyUrl: string;
}

export function VerifyEmailTemplate({ verifyUrl }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Verify your email to finish setting up Saasly CRM" heading="Verify your email">
      <Text>Click the link below to verify your email address and continue setting up your account.</Text>
      <Link href={verifyUrl}>{verifyUrl}</Link>
      <Text style={{ color: '#64748b', fontSize: '13px' }}>
        If you didn't create a Saasly CRM account, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
