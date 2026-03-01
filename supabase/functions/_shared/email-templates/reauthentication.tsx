/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Sherpa verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>SHERPA</Heading>
        </Section>
        <Heading style={h1}>VERIFICATION CODE</Heading>
        <Text style={text}>Use this code to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code expires shortly. If you didn't request it, ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: "'Inter', Courier, monospace",
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#141414',
  letterSpacing: '0.15em',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#a3a3a3', margin: '32px 0 0' }
