import { Link, Text } from '@react-email/components';
import { EmailLayout } from './layout.js';

export interface InviteLinkProps {
  inviteUrl: string;
  workspaceName: string;
}

export function InviteLinkTemplate({ inviteUrl, workspaceName }: InviteLinkProps) {
  return (
    <EmailLayout preview={`You've been invited to ${workspaceName} on Saasly CRM`} heading="You're invited">
      <Text>
        You've been invited to join <strong>{workspaceName}</strong> on Saasly CRM.
      </Text>
      <Link href={inviteUrl}>{inviteUrl}</Link>
    </EmailLayout>
  );
}
