# Domain Management Guide

## Overview

MailForge allows organizations to connect and verify custom domains for sending and receiving emails. Each domain must be verified with AWS SES before it can be used.

## Domain Lifecycle

```
1. Create Domain
   ↓
2. Add DNS Records (manual setup)
   ↓
3. Verify Domain
   ↓
4. Enable Inbound/Outbound
   ↓
5. Use for Mailboxes
```

## API Endpoints

### Create Domain

Add a new domain to your organization.

**Endpoint:**
```
POST /v1/organizations/{organizationId}/domains
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "domainName": "example.com"
}
```

**Requirements:**
- Domain must be valid format (e.g., example.com)
- Domain must not already be registered
- Requires Admin or Owner role

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "dom_abc123",
    "organizationId": "org_xyz789",
    "domainName": "example.com",
    "status": "pending",
    "verificationToken": "abc123def456...",
    "dkimStatus": "pending",
    "spfStatus": "pending",
    "dmarcStatus": "pending",
    "inboundEnabled": false,
    "outboundEnabled": false,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

**Status Values:**
- `pending`: Awaiting DNS verification
- `verified`: Successfully verified with SES
- `failed`: Verification failed

### List Domains

Get all domains for an organization.

**Endpoint:**
```
GET /v1/organizations/{organizationId}/domains
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "dom_abc123",
        "organizationId": "org_xyz789",
        "domainName": "example.com",
        "status": "verified",
        "dkimStatus": "verified",
        "spfStatus": "verified",
        "dmarcStatus": "pending",
        "inboundEnabled": true,
        "outboundEnabled": true,
        "createdAt": 1234567890,
        "updatedAt": 1234567890
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 50,
    "hasMore": false
  }
}
```

### Get Domain

Retrieve a specific domain.

**Endpoint:**
```
GET /v1/organizations/{organizationId}/domains/{domainId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "dom_abc123",
    "organizationId": "org_xyz789",
    "domainName": "example.com",
    "status": "verified",
    "dkimStatus": "verified",
    "spfStatus": "verified",
    "dmarcStatus": "pending",
    "inboundEnabled": true,
    "outboundEnabled": true,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

### Get DNS Records

Retrieve required DNS records for domain verification.

**Endpoint:**
```
GET /v1/organizations/{organizationId}/domains/{domainId}/dns-records
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verification": {
      "type": "TXT",
      "name": "_amazonses.example.com",
      "value": "verification-token-here",
      "required": true
    },
    "dkim": [
      {
        "type": "CNAME",
        "name": "token1._domainkey.example.com",
        "value": "token1.dkim.amazonses.com",
        "required": true
      },
      {
        "type": "CNAME",
        "name": "token2._domainkey.example.com",
        "value": "token2.dkim.amazonses.com",
        "required": true
      },
      {
        "type": "CNAME",
        "name": "token3._domainkey.example.com",
        "value": "token3.dkim.amazonses.com",
        "required": true
      }
    ],
    "spf": {
      "type": "TXT",
      "name": "example.com",
      "value": "v=spf1 include:amazonses.com ~all",
      "required": true
    },
    "dmarc": {
      "type": "TXT",
      "name": "_dmarc.example.com",
      "value": "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com",
      "required": false
    },
    "mx": {
      "type": "MX",
      "name": "example.com",
      "value": "10 inbound-smtp.us-east-1.amazonaws.com",
      "priority": 10,
      "required": true
    }
  }
}
```

### Verify Domain

Complete domain verification after DNS records are added.

**Endpoint:**
```
POST /v1/organizations/{organizationId}/domains/{domainId}/verify
Authorization: Bearer <token>
```

**Process:**
1. DNS records must be added to your DNS provider
2. SES will verify the records
3. Call this endpoint to confirm verification

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "dom_abc123",
    "organizationId": "org_xyz789",
    "domainName": "example.com",
    "status": "verified",
    "dkimStatus": "verified",
    "spfStatus": "verified",
    "dmarcStatus": "verified",
    "inboundEnabled": true,
    "outboundEnabled": true,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

### Delete Domain

Remove a domain from your organization.

**Endpoint:**
```
DELETE /v1/organizations/{organizationId}/domains/{domainId}
Authorization: Bearer <token>
```

**Effects:**
- Domain is removed from MailForge
- Domain is removed from SES
- All associated mailboxes will no longer function

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Domain deleted successfully"
  }
}
```

## DNS Setup Guide

### Step 1: Create Domain

Create a domain record in MailForge. It will enter "pending" status.

### Step 2: Get DNS Records

Call the DNS records endpoint to retrieve all required records.

### Step 3: Add to Your DNS Provider

Add all records marked as `required` to your DNS provider:

#### Verification Record (TXT)

Go to your DNS provider's DNS settings:

1. Create a TXT record
2. Name: `_amazonses.example.com`
3. Value: `verification-token-here` (from API)
4. TTL: 300 or default

**Example (Route 53):**
```
Name: _amazonses.example.com
Type: TXT
Value: "verification-token-here"
```

#### DKIM Records (CNAME)

Create three CNAME records:

```
Name: token1._domainkey.example.com
Type: CNAME
Value: token1.dkim.amazonses.com

Name: token2._domainkey.example.com
Type: CNAME
Value: token2.dkim.amazonses.com

Name: token3._domainkey.example.com
Type: CNAME
Value: token3.dkim.amazonses.com
```

#### SPF Record (TXT)

Create an SPF record:

```
Name: example.com
Type: TXT
Value: v=spf1 include:amazonses.com ~all
```

**If you already have an SPF record:**

Merge the mechanisms:
```
v=spf1 include:amazonses.com include:existing-provider.com ~all
```

#### DMARC Record (TXT)

Create a DMARC record (optional but recommended):

```
Name: _dmarc.example.com
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com
```

#### MX Record (MX)

Create an MX record for inbound email:

```
Name: example.com
Type: MX
Priority: 10
Value: inbound-smtp.us-east-1.amazonaws.com
```

**Note:** Replace `us-east-1` with your AWS region.

### Step 4: Verify Domain

Wait for DNS propagation (5-15 minutes typically), then call the verify endpoint.

The system will:
1. Check verification TXT record
2. Check DKIM CNAME records
3. Confirm DKIM is enabled in SES
4. Enable inbound/outbound email

### Step 5: Create Mailboxes

Once verified, create mailboxes using this domain.

## DNS Troubleshooting

### "Domain verification failed"

**Check:**
- All DNS records are added
- Records have propagated globally (5-15 minutes)
- Record values match exactly
- TTL hasn't expired

**Verify propagation:**
```bash
# Check TXT record
nslookup -type=TXT _amazonses.example.com

# Check CNAME record
nslookup -type=CNAME token1._domainkey.example.com

# Check MX record
nslookup -type=MX example.com
```

### "SPF record conflicts"

If you have an existing SPF record, merge the mechanisms:

**Existing:**
```
v=spf1 include:provider.com ~all
```

**New:**
```
v=spf1 include:provider.com include:amazonses.com ~all
```

### "DKIM verification pending"

DKIM verification can take 24-48 hours. Check back later.

## Regional Limitations

AWS SES is available in these regions for email:
- **us-east-1** (primary, recommended)
- us-west-2
- eu-west-1
- eu-central-1
- ap-southeast-1
- ap-northeast-1

Ensure your MailForge deployment is in a region with SES support.

## Security Considerations

1. **Verify Ownership**: Only add domains you own
2. **SPF Records**: Always set `~all` (softfail) or `-all` (fail)
3. **DMARC Policy**: Start with `p=none`, move to `p=quarantine`, then `p=reject`
4. **Monitoring**: Monitor bounce and complaint rates in CloudWatch

## SES Production Access

By default, SES accounts are in sandbox mode with limitations:
- Send only to verified email addresses
- Send maximum 1 email per second
- Send maximum 200 emails per 24 hours

### Request Production Access

1. Go to AWS SES console
2. Click "Edit Account Details"
3. Request production access
4. AWS typically approves within 24 hours

**Note:** Production access requires:
- At least 24-hour old AWS account
- CC/debit card on file
- Legitimate use case

## Cost

Domain verification is free. Email costs depend on SES pricing:
- **Inbound**: Free
- **Outbound**: $0.10 per 1000 emails
- **Bounce/Complaint**: Monitored for reputation

## Best Practices

1. **Warm Up**: Gradually increase sending volume
2. **Monitor**: Track bounces and complaints
3. **Authenticate**: Implement SPF, DKIM, DMARC
4. **List Maintenance**: Remove invalid addresses
5. **Compliance**: Honor unsubscribe requests
6. **GDPR**: Ensure proper consent and privacy policies

## Advanced: Subdomain Delegation

For larger organizations, consider delegating subdomains:

```
emails.example.com IN NS ns1.mailforge.example.com
```

This isolates email reputation from main domain.

## References

- [AWS SES Domain Verification](https://docs.aws.amazon.com/ses/latest/dg/verify-domains.html)
- [SES DKIM](https://docs.aws.amazon.com/ses/latest/dg/dkim.html)
- [SPF Record Documentation](https://tools.ietf.org/html/rfc7208)
- [DMARC Specification](https://tools.ietf.org/html/rfc7489)
