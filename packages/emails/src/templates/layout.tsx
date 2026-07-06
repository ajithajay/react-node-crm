import { Body, Container, Head, Heading, Html, Preview, Section } from '@react-email/components';
import type { ReactNode } from 'react';

export interface EmailLayoutProps {
  preview: string;
  heading: string;
  children: ReactNode;
}

export function EmailLayout({ preview, heading, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'sans-serif', padding: '24px 0' }}>
        <Container
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '32px',
            maxWidth: '480px',
          }}
        >
          <Heading as="h2" style={{ fontSize: '20px', margin: '0 0 16px' }}>
            {heading}
          </Heading>
          <Section>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}
