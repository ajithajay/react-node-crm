import { Text } from '@react-email/components';
import { EmailLayout } from './layout.js';

export function PasswordChangedTemplate() {
  return (
    <EmailLayout preview="Your Saasly CRM password was changed" heading="Password changed">
      <Text>Your password was just changed. If this wasn't you, contact support immediately.</Text>
    </EmailLayout>
  );
}
