# Gupshup WhatsApp Business API - Complete Documentation

Based on official Gupshup documentation:
- Main Guide: https://console-docs.gupshup.io/docs/whatsapp-business-api
- Message API: https://docs.gupshup.io/reference/msg
- Template Creation: https://docs.gupshup.io/reference/createtemplate
- Business Details: https://docs.gupshup.io/reference/get-business-details

**Last Updated:** 2026-11-17  
**API Base URL:** https://api.gupshup.io/wa/api/v1  
**App Base URL:** https://api.gupshup.io/wa/app/{appId}

---

## 📖 Table of Contents

1. [Session Messaging](#1-session-messaging)
2. [Send Message API](#2-send-message-api)
3. [Message Types](#3-message-types)
4. [Template Messaging](#4-template-messaging)
5. [Business Details API](#5-business-details-api)
6. [Error Codes](#6-error-codes)
7. [Supported Content Types](#7-supported-content-types)
8. [Integration Guide](#8-integration-guide)

---

## 1. Session Messaging

### Overview
You can send Session messages to **Active users only**. When a user sends a message to your WhatsApp Business API, they become an active user. A session starts from the latest user message. Sessions remain Active for **24 hours**.

### Usage
- Send messages within 24 hours of the last user message
- After 24 hours, you must use Template messaging
- Use the [Send Message API](https://docs.gupshup.io/reference/msg) for session messages

### Active Session Definition
- A user becomes "active" when they send your Business API a message
- Session timer resets with each new user message
- After 24 hours of inactivity, the session expires

---

## 2. Send Message API

### API Endpoint
```
POST https://api.gupshup.io/wa/api/v1/msg
```

### Required Headers
| Header | Value |
|--------|-------|
| `Content-Type` | `application/x-www-form-urlencoded` |
| `apikey` | Your Gupshup account API key |

### Required Form Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `channel` | string | The channel for sending messages | `whatsapp` |
| `source` | string/integer | Your registered WhatsApp Business API phone number (E.164 format) | `917834811114` |
| `destination` | string/integer | User's phone number (E.164 format) | `919876543210` |
| `message` | object | The message object (varies by type) | See Message Types below |
| `src.name` | string | The Gupshup app name registered against the phone number | `DemoAPI` |

### Optional Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `disablePreview` | boolean | Enable/disable URL preview for text messages | `false` |
| `encode` | boolean | Encode emoji in Interactive List messages | `false` |

### API Response

| Header | Value |
|--------|-------|
| `Content-Type` | `text/html` |

```json
{
   "status":"submitted",
   "messageId":"ee4a68a0-1203-4c85-8dc3-49d0b3226a35"
}
```

**Response Fields:**
- `status`: `"submitted"` - API call was successful, request is submitted
- `messageId`: Unique identifier for tracking message status via DLR events on webhook

### cURL Example (Text Message)
```bash
curl --location --request POST 'https://api.gupshup.io/wa/api/v1/msg' \
--header 'apikey: 2xxc4x4xx2c94xxxc2f9xx9d43xxxx8a' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'channel=whatsapp' \
--data-urlencode 'source=917834811114' \
--data-urlencode 'destination=919876543210' \
--data-urlencode 'message={"type":"text","text":"Hello user, how are you?"}' \
--data-urlencode 'src.name=DemoAPI'
```

---

## 3. Message Types

The Send Message API supports **11 message types**. Each type has a specific JSON schema.

### 3.1 Text Message

```json
{
   "type":"text",
   "text":"Hello user, how are you?"
}
```

**Schema:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"text"` |
| `text` | string | ✅ | The text message content (max 4096 characters) |

**URL Preview:**
- Include `preview_url: true` in the message body to make URLs clickable
- URL must begin with `http://` or `https://`
- Hostname is required, IP addresses are not matched

### 3.2 Image Message

```json
{
   "type":"image",
   "originalUrl":"https://www.buildquickbots.com/whatsapp/media/sample/jpg/sample01.jpg",
   "previewUrl":"https://www.buildquickbots.com/whatsapp/media/sample/jpg/sample01.jpg",
   "caption":"Sample image"
}
```

**Schema:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"image"` |
| `originalUrl` | string | ✅ | Public URL of the image hosted |
| `previewUrl` | string | ✅ | Public URL of the thumbnail |
| `caption` | string | ✅ | Caption of the image |

**Specifications:**
- **Max file size**: 5 MB
- **Format**: `image/jpeg`, `image/png`
- **Aspect Ratio**: WhatsApp vertically crops images with 1:91:1 ratio (800×418 pixels)
- **Design Tip**: Place crux information at the center of the image

### 3.3 Video Message

```json
{
   "type":"video",
   "url":"https://www.buildquickbots.com/whatsapp/media/sample/video/sample01.mp4",
   "caption":"Sample video"
}
```

**Schema:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"video"` |
| `url` | string | ✅ | Public URL of the video file |
| `caption` | string | ✅ | Caption of the video |

**Specifications:**
- **Max file size**: 16 MB
- **Codecs**: H.264 video codec, AAC audio codec only
- **Supported Formats**: `video/mp4`, `video/3gpp`

### 3.4 Audio Message

```json
{
   "type":"audio",
   "url":"https://www.buildquickbots.com/whatsapp/media/sample/audio/sample02.mp3"
}
```

**Schema:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"audio"` |
| `url` | string | ✅ | Public URL of the audio file |

**Specifications:**
- **Max file size**: 16 MB
- **Supported Formats**: `audio/aac`, `audio/mp4`, `audio/amr`, `audio/mpeg`, `audio/ogg; codecs=opus`
- **Note**: Base audio/ogg type is NOT supported

### 3.4 Document/File Message

```json
{
   "type":"file",
   "url":"https://www.buildquickbots.com/whatsapp/media/sample/pdf/sample01.pdf",
   "filename":"Sample file"
}
```

**Schema:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"file"` |
| `url` | string | ✅ | Public URL of the file hosted |
| `filename` | string | ✅ | Name of the file |

**Specifications:**
- **Max file size**: 100 MB
- **Format**: Any valid MIME-type supported

### 3.5 Sticker Message

```json
{
   "type":"sticker",
   "url":"http://www.buildquickbots.com/whatsapp/stickers/SampleSticker01.webp"
}
```

**Schema:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"sticker"` |
| `url` | string | ✅ | Public URL of the sticker file |

**Specifications:**
- **Max file size**: 100 KB
- **Format**: `.webp` only
- **Dimensions**: Must be exactly 512×512 pixels
- **Note**: No support for animated stickers; each sticker has a transparent background

### 3.6 Location Message

```json
{
   "type":"location",
   "longitude":72.877655,
   "latitude":19.075983,
   "name":"Mumbai",
   "address":"Mumbai, Maharashtra"
}
```

**Schema:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"location"` |
| `longitude` | number | ✅ | Longitude coordinate |
| `latitude` | number | ✅ | Latitude coordinate |
| `name` | string | ✅ | Name of the location |
| `address` | string | ✅ | Address of the location |

### 3.7 Contact Message

```json
{
   "type":"contact",
   "contact":{
      "addresses":[
         {
            "city":"Menlo Park",
            "country":"United States",
            "countryCode":"us",
            "state":"CA",
            "street":"1 Hacker Way",
            "type":"HOME",
            "zip":"94025"
         }
      ],
      "name":{
         "firstName":"John",
         "lastName":"Wick"
      },
      "phones":[
         {
            "phone":"+1 (940) 555-1234",
            "type":"HOME"
         }
      ]
   }
}
```

**Schema:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"contact"` |
| `contact` | object | ✅ | Contact Object (see below) |

**Contact Object Nested Structure:**

**Address Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `city` | string | ✅ | City |
| `country` | string | ✅ | Country |
| `countryCode` | string | ✅ | Country code (e.g., "us") |
| `state` | string | ✅ | State |
| `street` | string | ✅ | Street address |
| `type` | string | ✅ | Address type (e.g., "HOME", "WORK") |
| `zip` | string | ✅ | Postal code |

**Name Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `firstName` | string | ✅ | First name |
| `formattedName` | string | ✅ | Formatted full name |
| `lastName` | string | ✅ | Last name |

**Email Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `email` | string | ✅ | Email address |
| `type` | string | ✅ | Email type (e.g., "Personal", "Work") |

**Phone Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `phone` | string | ✅ | Phone number |
| `type` | string | ✅ | Phone type (e.g., "HOME", "WORK") |
| `wa_id` | string | ✅ | WhatsApp ID |

**Org Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `company` | string | ✅ | Company name |
| `department` | string | ✅ | Department |
| `title` | string | ✅ | Job title |

**Url Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `url` | string | ✅ | URL |
| `type` | string | ✅ | URL type (e.g., "WORK") |

### 3.7 Quick Reply Messages

Gupshup supports **3 variations** of quick reply messages:

#### A. Quick Reply - Text

```json
{
   "type":"quick_reply",
   "msgid":"qr1",
   "content":{
      "type":"text",
      "header":"this is the header",
      "text":"this is the body",
      "caption":"this is the footer"
   },
   "options":[
      {
         "type":"text",
         "title":"First",
         "postbackText": "dev-defined-postback1"
      },
      {
         "type":"text",
         "title":"Second",
         "postbackText": "dev-defined-postback2"
      },
      {
         "type":"text",
         "title":"Third",
         "postbackText": "dev-defined-postback3"
      }
   ]
}
```

**Schema Requirements:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"quick_reply"` |
| `msgid` | string | ✅ | Developer-defined message ID |
| `content` | object | ✅ | Content object |
| `options` | array | ✅ | Up to 3 options supported |

**Content Object (Text):**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"text"` |
| `header` | string | ✅ | Header of the text message (max 20 chars) |
| `text` | string | ✅ | Body of the message |
| `caption` | string | ✅ | Footer/caption (max 60 chars) |

**Option Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"text"` |
| `title` | string | ✅ | Button title (max 20 chars, unique, no emojis/markdown) |
| `postbackText` | string | ✅ | Developer-defined payload on button click |

#### B. Quick Reply - Image/Video

```json
{
   "type":"quick_reply",
   "msgid":"qr1",
   "content":{
      "type":"image/video",
      "url":"https://www.buildquickbots.com/whatsapp/media/sample/jpg/sample01.jpg",
      "text":"this is the body",
      "caption":"this is the footer"
   },
   "options":[
      {
         "type":"text",
         "title":"First",
         "postbackText": "dev-defined-postback1"
      }
   ]
}
```

**Content Object (Image/Video):**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"image/video"` |
| `url` | string | ✅ | Public URL of the media file |
| `text` | string | ✅ | Body of the message |
| `caption` | string | ✅ | Footer/caption |

#### C. Quick Reply - File

```json
{
   "type":"quick_reply",
   "msgid":"qr1",
   "content":{
      "type":"file",
      "url":"https://www.buildquickbots.com/whatsapp/media/sample/pdf/sample01.pdf",
      "text":"this is the body",
      "filename":"Sample file",
      "caption":"this is the footer"
   },
   "options":[
      {
         "type":"text",
         "title":"First",
         "postbackText": "dev-defined-postback1"
      }
   ]
}
```

**Content Object (File):**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"file"` |
| `url` | string | ✅ | Public URL of the media file |
| `text` | string | ✅ | Body of the message |
| `filename` | string | ✅ | Name of the file |
| `caption` | string | ✅ | Footer/caption |

### 3.8 List Message (Interactive)

```json
{
   "type":"list",
   "title":"title text",
   "body":"body text",
   "footer":"footer text",
   "msgid":"list1",
   "globalButtons":[
      {
         "type":"text",
         "title":"Global button"
      }
   ],
   "items":[
      {
         "title":"first Section",
         "subtitle":"first Subtitle",
         "options":[
            {
               "type":"text",
               "title":"section 1 row 1",
               "description":"first row of first section description",
               "postbackText":"section 1 row 1 postback payload"
            }
         ]
      },
      {
         "title":"second section",
         "subtitle":"second Subtitle",
         "options":[
            {
               "type":"text",
               "title":"section 2 row 1",
               "description":"first row of second section description",
               "postbackText":"section 1 row 3 postback payload"
            }
         ]
      }
   ]
}
```

**Schema Requirements:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"list"` |
| `title` | string | ✅ | Title/header text (max 60 chars) |
| `body` | string | ✅ | Body text (max 1024 chars, emojis/markdown/links supported) |
| `msgid` | string | ✅ | Developer-defined message ID |
| `globalButtons` | array | ✅ | Global action buttons |
| `items` | array | ✅ | Up to 10 items supported |

**Global Button Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"text"` |
| `title` | string | ✅ | Button title (max 20 chars, unique, no emojis/markdown) |

**Item Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `title` | string | ✅ | Section title (max 24 chars, required if >1 section) |
| `subtitle` | string | ✅ | Section subtitle (max 24 chars, required if >1 section) |
| `options` | array | ✅ | List of options in this section |

**Option Object:**
| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `type` | string | ✅ | Must be `"text"` |
| `title` | string | ✅ | Item title (max 24 chars) |
| `description` | string | ✅ | Item description (max 72 chars, optional) |
| `postbackText` | string | ✅ | Developer-defined payload on selection |

### 3.9 Supported Content Types Summary

| Message Type | Max Size | Supported Formats | Backend Support | Frontend UI |
|--------------|----------|-------------------|-----------------|-------------|
| **text** | 4096 chars | Text | ✅ | ✅ |
| **image** | 5 MB | jpeg, png | ✅ | ✅ |
| **video** | 16 MB | mp4, 3gpp (H.264/AAC) | ✅ | ❌ |
| **audio** | 16 MB | aac, mp4, amr, mpeg, ogg (opus) | ✅ | ❌ |
| **file/document** | 100 MB | Any MIME type | ✅ | ✅ |
| **sticker** | 100 KB | webp (512x512) | ❌ | ❌ |
| **location** | N/A | N/A | ✅ | ❌ |
| **contact** | N/A | N/A | ✅ | ❌ |
| **quick_reply** | 3 options | text/image/file | ✅ | ❌ |
| **list_message** | 10 items | text with options | ✅ | ❌ |

---

## 4. Template Messaging

### Overview
Template messages are **Highly Structured (HSM)/Notification messages**. Once your WhatsApp Business API is Live, you can create template messages and submit them to WhatsApp for approval. You can send Template messages to users that you have **opted-in**.

### API Endpoint
```
POST https://api.gupshup.io/wa/api/v1/template/msg
```

### Required Headers
| Header | Value |
|--------|-------|
| `Content-Type` | `application/x-www-form-urlencoded` |
| `apikey` | Your Gupshup account API key |

### Required Form Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `source` | string | Your registered WhatsApp Business API phone number (E.164 format) | `917834811114` |
| `destination` | string | User's phone number (E.164 format) | `919876543210` |
| `template` | object | Template object (see below) | See Template Object Description |
| `message` | object | **Required only if template is of type Media** | See Message Object Description |

### Template Object Description

| Key | Type | Required | Description | Sample |
|-----|------|----------|-------------|--------|
| `id` | string | ✅ | Unique identifier for a template | `c6aecef6-bcb0-4fb1-8100-28c094e3bc6b` |
| `params` | array | ✅ | Array of placeholders/variables in order | `["Agent","Local Address","Tracking code"]` |

### Message Object Description (for Media Templates)

| Key | Type | Required | Description | Sample |
|-----|------|----------|-------------|--------|
| `type` | string | ✅ | Media type: `image`, `video`, `document`, `location` | `image` |
| `image` / `video` / `document` / `location` | object | Conditional | Link to media file | `{"link":"https://..."}` |

#### Image Message (Template)
```json
{"type":"image","image":{"link":"https://www.buildquickbots.com/whatsapp/media/sample/jpg/sample01.jpg"}}
```

#### Video Message (Template)
```json
{"type":"video","video":{"link":"https://www.buildquickbots.com/whatsapp/media/sample/video/sample01.mp4"}}
```

#### Document Message (Template)
```json
{"type":"document","document":{"link":"https://www.buildquickbots.com/whatsapp/media/sample/pdf/sample01.pdf","filename":"Sample functional resume"}}
```

#### Location Message (Template)
```json
{"type":"location","location":{"longitude":"","latitude":""}}
```

### Template Creation

**Endpoint:**
```
POST https://api.gupshup.io/wa/app/{appId}/template
```

**Required Parameters:**
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `elementName` | string | The name of the element | `auth_template` |
| `languageCode` | string | Language code (e.g., "en") | `en` |
| `category` | string | Template category | `AUTHENTICATION`, `UTILITY`, `MARKETING` |
| `templateType` | string | Type of template | `TEXT`, `IMAGE`, `VIDEO`, `DOCUMENT` |
| `allowTemplateCategoryChange` | boolean | Allow Meta to change category during approval | `false` |
| `buttons` | array | Optional interactive buttons (for AUTHENTICATION) | See below |
| `addSecurityRecommendation` | boolean | Allow security disclaimer | `false` |
| `codeExpirationMinutes` | integer | OTP expiration in minutes (1-90) | `20` |

**Buttons (for AUTHENTICATION templates):**
```json
"buttons":[
   {
      "type":"OTP",
      "otp_type":"COPY_CODE",
      "text":"Copy code"
   }
]
```

### Template Status Workflow

```
PENDING  →  APPROVED/REJECTED
```

- Templates start as `PENDING` after creation
- Submitted to WhatsApp for review
- Status changes to `APPROVED` or `REJECTED`
- **Templates can ONLY be edited via Gupshup dashboard** (no API edit endpoint)
- **Templates can ONLY be deleted via Gupshup dashboard** (no API delete endpoint)

### Template Usage in Send Message

```bash
curl --location --request POST 'https://api.gupshup.io/wa/api/v1/template/msg' \
--header 'apikey: 2xxc4x4xx2c94xxxc2f9xx9d43xxxx8a' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'source=917834811114' \
--data-urlencode 'destination=918x98xx21x4' \
--data-urlencode 'template={"id": "c6aecef6-bcb0-4fb1-8100-28c094e3bc6b","params": ["Agent","Local Address","Tracking code"]}'
```

---

## 5. Business Details API

### Overview
Retrieve business profile details from your Gupshup account. This includes address, contact information, business vertical, and compliance status.

### API Endpoint
```
GET https://api.gupshup.io/wa/app/{appId}/business
```

### Required Headers
| Header | Value |
|--------|-------|
| `apikey` | Your Gupshup account API key |

### Path Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `appId` | string | Unique identifier for the app | `1b73dad6-xxxx-xxxx-xxxx-60981da19f70` |

### Response Structure

```json
{
    "status": "success",
    "business": {
        "id": "{{APP_ID}}",
        "name": "{{BUSINESS_NAME}}",
        "about": "{{DESCRIPTION}}",
        "description": "{{DESCRIPTION}}",
        "about": "{{DESCRIPTION}}",
        "addressLine1": "{{ADDRESS_LINE_1}}",
        "addressLine2": "{{ADDRESS_LINE_2}}",
        "displayAddress": "{{ADDRESS}}",
        "city": "{{CITY}}",
        "state": "{{STATE}}",
        "country": "{{COUNTRY_CODE}}",
        "pinCode": "{{PINCODE}}",
        "preferredCountry": "{{PREFERRED_COUNTRY}}",
        "hqRegion": "{{HQ_REGION}}",
        "vertical": "{{BUSINESS_VERTICAL}}",
        "website": "{{BUSINESS_WEBSITE}}",
        "altWebsite": "{{ALT_WEBSITE_URL}}",
        "email": "{{EMAIL_ID}}",
        "profileEmail": "{{PROFILE_EMAIL}}",
        "contactName": "{{CONTACT_NAME}}",
        "contactNumber": "{{CONTACT_NUMBER}}",
        "tncAccepted": {{STATUS_OF_TERMS_ACCEPTANCE}},
        "emailVerified": {{STATUS_OF_EMAIL_VERIFICATION}},
        "createdOn": {{CREATED_ON_TIMESTAMP}},
        "modifiedOn": {{LAST_MODIFIED_ON_TIMESTAMP}}
    }
}
```

**Full Field Details:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique business identifier (APP_ID) |
| `name` | string | Business name |
| `about` | string | Description about the business |
| `addressLine1` | string | First line of address |
| `addressLine2` | string | Second line of address |
| `displayAddress` | string | Multi-line display address |
| `city` | string | City |
| `state` | string | State |
| `country` | string | Country code |
| `pinCode` | string | Postal code |
| `preferredCountry` | string | Preferred country |
| `hqRegion` | string | Headquarters region |
| `vertical` | string | Business vertical |
| `website` | string (uri) | Business website URL |
| `altWebsite` | string (uri) | Alternate website URL |
| `email` | string (email) | Business email address |
| `profileEmail` | string | Profile email |
| `contactName` | string | Name of contact person |
| `contactNumber` | string | Business contact number |
| `tncAccepted` | boolean | Terms and conditions acceptance status |
| `emailVerified` | boolean | Email verification status |
| `createdOn` | integer (int64) | Creation timestamp |
| `modifiedOn` | integer (int64) | Last modification timestamp |

**Status Codes:**
| Code | Response | Comments |
|------|----------|----------|
| `200` | Success | Business details retrieved |
| `400` | Error | `"Invalid app id provided"` |
| `401` | Error | `"Authentication Failed"` |

### cURL Example
```bash
curl --location 'https://api.gupshup.io/wa/app/1b73dad6-xxxx-xxxx-xxxx-60981da19f70/business' \
--header 'apikey: 2xxc4x4xx2c94xxxc2f9xx9d43xxxx8a'
```

---

## 6. Error Codes

### Session Messaging Errors

| Code | Meaning |
|------|---------|
| `1001` | Last mapped bot and sender details mismatched |
| `1002` | Number does not exist on WhatsApp |
| `1003` | Insufficient wallet balance |
| `1004` | Template messaging disabled, user inactive for session |
| `1005` | User not opted-in for template message |
| `1006` | User not opted-in, not active for session |
| `1007` | Not opted-in, not active, template didn't match |
| `1008` | User not opted-in and inactive |
| `1010` | Invalid Media URL (sandbox mode only) |
| `1011` | Invalid Media Size |

### General Error Codes

| Code | Meaning |
|------|---------|
| `1001` | Last mapped bot and sender details mismatched |
| `1002` | Number does not exist on WhatsApp |

### Response Format (Error)
```json
{
   "status":"error",
   "message":"Error description"
}
```

---

## 7. Supported Content Types

### Media Specifications

| Type | Format | Max Size | Codecs/Requirements |
|------|--------|----------|---------------------|
| **Image** | jpeg, png | 5 MB | Vertically crops to 1:91:1 (800×418 px) |
| **Video** | mp4, 3gpp | 16 MB | H.264 video + AAC audio only |
| **Audio** | aac, mp4, amr, mpeg, ogg (opus) | 16 MB | Base audio/ogg NOT supported |
| **File/Document** | Any MIME type | 100 MB | No specific codec restrictions |
| **Sticker** | webp | 100 KB | Must be 512×512 px, no animated stickers |

### Text Specifications

| Specification | Limit |
|---------------|-------|
| **Max text message length** | 4096 characters |
| **URL preview** | Automatic if URL starts with http:// or https:// |
| **Multiple URLs** | Only first URL is previewed |
| **Quick reply options** | Max 3 options |
| **List message items** | Max 10 items |
| **List message global buttons** | Unlimited (must be unique titles) |

### Quick Reply Specifications

| Variation | Max Options | Content Types |
|-----------|-------------|---------------|
| **Text** | 3 | text only |
| **Image/Video** | 3 | image or video with text |
| **File** | 3 | file with text |

### List Message Specifications

| Feature | Limit |
|---------|-------|
| **Max items** | 10 |
| **Max global buttons** | Unlimited (must have unique titles) |
| **Title max chars** | 60 |
| **Body max chars** | 1024 (emojis/markdown/links supported) |
| **Item title max chars** | 24 |
| **Item subtitle max chars** | 24 |
| **Item description max chars** | 72 (optional) |
| **postbackText** | Required for each option |

---

## 8. Integration Guide

### Prerequisites

1. **Gupshup Account**: Have a registered WhatsApp Business API account
2. **API Key**: Obtain your API key from Gupshup dashboard
3. **App Name**: Register an app name against your WhatsApp phone number
4. **Phone Number**: Have a verified WhatsApp Business API phone number (E.164 format)

### Workflow: Sending a Text Message

1. **Get API key** from Gupshup dashboard
2. **Register app name** against your WhatsApp phone number
3. **Send message** using the Send Message API

```javascript
// Example: Send text message using Node.js
const axios = require('axios');

const apiKey = '2xxc4x4xx2c94xxxc2f9xx9d43xxxx8a';
const source = '917834811114'; // Your WhatsApp number
const destination = '919876543210'; // User's number

const payload = {
  channel: 'whatsapp',
  source: source,
  destination: destination,
  message: {
    type: 'text',
    text: 'Hello! This is a test message from MuxroCRM'
  },
  src.name: 'MuxroCRM'
};

axios.post('https://api.gupshup.io/wa/api/v1/msg', payload, {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    apikey: apiKey
  }
})
.then(response => {
  console.log('Message submitted:', response.data);
})
.catch(error => {
  console.error('Send failed:', error.response?.data || error.message);
});
```

### Workflow: Sending a Template Message

1. **Create template** via Gupshup dashboard or API (`POST /{appId}/template`)
2. **Wait for approval** (PENDING → APPROVED/REJECTED)
3. **Send template message** using Template Messaging API

```bash
# Send approved template
curl --location --request POST 'https://api.gupshup.io/wa/api/v1/template/msg' \
--header 'apikey: 2xxc4x4xx2c94xxxc2f9xx9d43xxxx8a' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'source=917834811114' \
--data-urlencode 'destination=919876543210' \
--data-urlencode 'template={"id": "c6aecef6-bcb0-4fb1-8100-28c094e3bc6b","params": ["Agent","Local Address"]}'
```

### Webhook Events (DLR - Delivery Receipts)

When messages are sent, Gupshup sends events to your webhook/callback URL with status updates:

| Event | Description |
|-------|-------------|
| `enqueued` | Message is enqueued for sending |
| `sent` | Message sent to WhatsApp |
| `delivered` | Message delivered to user's device |
| `read` | Message read by user |
| `failed` | Message failed to send |

### Webhook Payload Example
```json
{
  "event": "delivered",
  "messageId": "ee4a68a0-1203-4c85-8dc3-49d0b3226a35",
  "status": "delivered",
  "timestamp": 1234567890
}
```

---

## 📋 Quick Reference: Message Type Selection Guide

| Use Case | Recommended Message Type | API Endpoint |
|----------|------------------------|--------------|
| **Simple text** | `text` | `POST /wa/api/v1/msg` |
| **Send image** | `image` | `POST /wa/api/v1/msg` |
| **Send video** | `video` | `POST /wa/api/v1/msg` |
| **Send audio** | `audio` | `POST /wa/api/v1/msg` |
| **Send file/document** | `file` | `POST /wa/api/v1/msg` |
| **Send location** | `location` | `POST /wa/api/v1/msg` |
| **Share contact** | `contact` | `POST /wa/api/v1/msg` |
| **Quick action buttons** | `quick_reply` | `POST /wa/api/v1/msg` |
| **List of options** | `list_message` | `POST /wa/api/v1/msg` |
| **Send template** | `template` | `POST /wa/api/v1/template/msg` |
| **Within 24h of user msg** | `text` (session) | `POST /wa/api/v1/msg` |
| **After 24h or marketing** | `template` | `POST /wa/api/v1/template/msg` |

---

## 🔧 Implementation Notes for MuxroCRM

### Current Backend Support (MuxroCRM)

Based on the MuxroCRM codebase analysis:

**✅ Implemented Message Types:**
- `text` - `sendText()` in whatsapp.service.ts
- `image` - `sendImage()` in whatsapp.service.ts
- `video` - `sendVideo()` in whatsapp.service.ts
- `audio` - `sendAudio()` in whatsapp.service.ts
- `file/document` - `sendFile()` in whatsapp.service.ts
- `location` - `sendLocation()` in whatsapp.service.ts
- `contact` - `sendContact()` in whatsapp.service.ts
- `quick_reply` - `sendQuickReply()` in whatsapp.service.ts
- `list_message` - `sendList()` in whatsapp.service.ts

**❌ Not Implemented:**
- `sticker` - Gupshup supports but backend missing
- Template `create` via API - Available in docs but not implemented
- Template `edit`/`delete` - Not available via API (dashboard only)

**⚠️ Business Profile:**
- Business details API available but 0/27 fields implemented
- Only 4 Gupshup settings stored (apiKey, source, appName, appId)

### Priority Integration Items

1. **High**: Wire up quick_reply and list_message UI (backend already supports)
2. **High**: Add sticker sending support (Gupshup API available, backend missing)
3. **Medium**: Implement template creation via backend API
4. **Medium**: Fetch and display business profile in chat UI
5. **Low**: Template edit/delete (must use Gupshup dashboard only)

---

## 📞 Support & Resources

- **Gupshup Documentation**: https://docs.gupshup.io
- **WhatsApp Business API**: https://console-docs.gupshup.io/docs/whatsapp-business-api
- **API Explorer**: https://docs.gupshup.io/reference/msg
- **Support**: Contact Gupshup support for API issues or template approval questions

---
*Documentation generated from official Gupshup API references on 2026-11-17*