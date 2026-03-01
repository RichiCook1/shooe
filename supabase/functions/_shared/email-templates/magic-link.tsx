/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Sherpa login link</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>SHERPA</Heading>
        </Section>
        <Heading style={h1}>YOUR LOGIN LINK</Heading>
        <Text style={text}>
          Tap below to log in. This link expires shortly.
        </Text>
        <Button style={button} href={confirmationUrl}>
          LOG IN
        </Button>
        <Text style={footer}>
          Didn't request this? You can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px' }
const header = { marginBottom: '32px' }
const brand = {
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#141414',
  letterSpacing: '0.12em',
  margin: '0',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#141414',
  letterSpacing: '0.06em',
  margin: '0 0 20px',
  textTransform: 'uppercase' as const,
}
const text = {
  fontSize: '14px',
  color: '#737373',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const button = {
  backgroundColor: '#141414',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: '600' as const,
  letterSpacing: '0.08em',
  borderRadius: '8px',
  padding: '14px 24px',
  textDecoration: 'none',
  textTransform: 'uppercase' as const,
}
const footer = { fontSize: '12px', color: '#a3a3a3', margin: '32px 0 0' }
