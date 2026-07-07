# MuxRo Ultimate CRM - Complete Customer Guide

Welcome to MuxRo Ultimate CRM! This guide will help you understand and use all the features of our comprehensive Customer Relationship Management system.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication & Account Management](#authentication--account-management)
3. [Core Features](#core-features)
4. [Managing Campaigns](#managing-campaigns)
5. [Working with Leads](#working-with-leads)
6. [Follow-ups & Scheduling](#follow-ups--scheduling)
7. [Dashboard & Analytics](#dashboard--analytics)
8. [Forms & Lead Capture](#forms--lead-capture)
9. [Bulk Operations](#bulk-operations)
10. [Notifications](#notifications)
11. [Integrations](#integrations)
12. [Best Practices](#best-practices)
13. [FAQs](#faqs)

---

## Getting Started

### System Overview

MuxRo Ultimate CRM is a powerful cloud-based platform designed to help your team manage customer relationships efficiently. Whether you're running sales campaigns, tracking leads, or coordinating team follow-ups, our system provides the tools you need.

### Accessing the System

1. **Log in**: Visit the application and enter your username and password
2. **Security**: Your login is secure with JWT authentication and encrypted credentials
3. **Rate Limiting**: Your account is protected with login attempt limits (5 attempts per minute)

### User Roles

MuxRo has two primary user roles:

- **Admin**: Full system access including user management, campaign creation, and configuration
- **User**: Can work with assigned campaigns, manage leads, and track follow-ups

---

## Authentication & Account Management

### Logging In

1. Enter your username and password
2. Click "Login"
3. You'll be redirected to the dashboard
4. Your session is maintained securely using httpOnly cookies

### Account Security

- **Password Protection**: Your password is encrypted and secure
- **Session Management**: You can log out from any page
- **Rate Limiting**: Login attempts are rate-limited to prevent unauthorized access

### User Management (Admins Only)

**Creating New Users:**
1. Navigate to User Management
2. Click "Add New User"
3. Enter username and set initial password
4. Assign user role (Admin or User)
5. Click "Create"

**Deactivating Users:**
1. Go to User Management
2. Find the user you want to deactivate
3. Click "Deactivate" (they won't be able to log in)

---

## Core Features

### What is a Lead?

A **Lead** is a potential customer or contact. Each lead contains:
- **Basic Information**: Name, email, phone number
- **Source**: Where the lead came from (manual entry, form, integration, etc.)
- **Custom Data**: Additional fields specific to your business needs
- **Status**: Current stage in your sales pipeline
- **Assignment**: Who is responsible for follow-ups (the "doer")
- **DND Flag**: "Do Not Disturb" - mark leads you shouldn't contact

### Key Business Objects

1. **Campaign**: A marketing or sales initiative that groups related leads and team members
2. **Follow-up**: A scheduled action or note associated with a lead (e.g., "Call customer", "Send quote")
3. **Form**: A web form for capturing leads from your website
4. **Enquiry**: A lead submission from a public form

---

## Managing Campaigns

### Creating a Campaign

1. **Navigate to Campaigns**: Go to the Campaigns section
2. **Click "New Campaign"**: Enter the campaign details
3. **Campaign Name**: Give your campaign a descriptive name
4. **Manager**: Select who will manage this campaign
5. **Click "Create"**: The campaign is now active

### Customizing Campaign Status Pipeline

Each campaign can have its own status labels with custom colors:

1. **Open the Campaign**: Click on the campaign name
2. **Go to Statuses**: Look for "Campaign Statuses" or "Manage Statuses"
3. **Add Status**: Click "Add Status" and enter:
   - Status name (e.g., "Contacted", "Interested", "Proposal Sent")
   - Color for visual identification
4. **Save**: Your custom statuses are now available for leads in this campaign

### Assigning Team Members to Campaigns

1. **Open the Campaign**: Click on the campaign
2. **Go to Team**: Navigate to "Assigned Users" or "Team Members"
3. **Add User**: Click "Add User"
4. **Select User**: Choose team members to assign
5. **Set Status**: Choose if they're active or inactive
6. **Save**: Users can now work with leads in this campaign

### Activating/Deactivating Campaigns

- **Active Campaign**: Team members can add leads and work with them
- **Inactive Campaign**: The campaign is archived but data is preserved
- Use this to keep your system organized as campaigns complete

---

## Working with Leads

### Adding Leads Manually

1. **Go to Campaign**: Select the campaign
2. **Click "Add Lead"**: Or "New Lead"
3. **Fill in Details**:
   - Name (required)
   - Email
   - Phone
   - Additional custom fields (varies by campaign)
4. **Assign Lead**: Select the team member responsible ("doer")
5. **Set Status**: Choose the initial status (e.g., "New")
6. **Source**: Indicate where the lead came from
7. **Click "Save"**: Lead is now in your system

### Viewing Leads

**By Campaign:**
1. Go to Campaigns
2. Click on a campaign to see all its leads
3. Filter or search by name, phone, or email

**Lead Details:**
- Click on any lead to see full information
- View all follow-ups for that lead
- See lead history and interactions
- Edit lead information as needed

### Lead Statuses

Move leads through your sales pipeline:

1. **Select Lead**: Click on the lead
2. **Change Status**: Look for the status dropdown or selector
3. **Choose New Status**: Select from campaign-specific statuses
4. **Add Remarks** (optional): Note why you're changing status
5. **Save**: Status is updated

### Do Not Disturb (DND) Flag

Mark leads you shouldn't contact:

1. **Open Lead**
2. **Click "Mark as DND"** or toggle the DND flag
3. **Purpose**: Ensures compliance with contact preferences
4. **Filtering**: You can filter out DND leads from outreach lists

### Editing Lead Information

1. **Open the Lead**
2. **Click "Edit"** or pencil icon
3. **Update Fields**:
   - Basic information (name, email, phone)
   - Custom fields
   - Additional notes
4. **Click "Save"**

### Lead Statistics

- **View Stats**: Each campaign shows statistics about its leads
- **Conversion Rates**: See how many leads move to each stage
- **Performance Metrics**: Track which team members are most effective

---

## Follow-ups & Scheduling

### What is a Follow-up?

A **Follow-up** is a scheduled action or note about a lead. Examples:
- "Call customer on Monday"
- "Send proposal by Friday"
- "Check on order status"

### Creating a Follow-up

1. **Open Lead**: Click on the lead
2. **Go to Follow-ups**: Look for "Add Follow-up" or "New Follow-up"
3. **Fill in Details**:
   - **Status**: What needs to be done? (e.g., "Call", "Email", "Meeting")
   - **Remarks**: Detailed notes about the follow-up
   - **Next Call Date**: When to follow up (date and time)
   - **Assigned User**: Who should do this (usually the lead's doer)
4. **Click "Save"**: Follow-up is scheduled

### Viewing Follow-ups

**Upcoming Follow-ups:**
1. Go to Dashboard or Notifications
2. See all follow-ups due today, tomorrow, or overdue
3. Click on a follow-up to open the related lead

**Per Lead:**
1. Open a lead
2. Scroll to "Follow-ups" section
3. See all past and future follow-ups
4. Edit or add more follow-ups

### Follow-up Dashboard

1. **Go to Dashboard**: Select "Follow-up Dashboard"
2. **View Your Follow-ups**: See all follow-ups assigned to you
3. **By Date**: Organize by due date
4. **Organize**: Sort by priority, campaign, or lead name

### Completing or Updating Follow-ups

1. **Open Follow-up**: Click on the follow-up
2. **Update Status**: Mark as completed or change status
3. **Add Remarks**: Note what happened
4. **Schedule Next**: If needed, create another follow-up
5. **Save**: Changes are recorded

---

## Dashboard & Analytics

### Main Dashboard Overview

The main dashboard provides a quick snapshot:

- **Key Metrics**: Total leads, campaigns, team members
- **Recent Activity**: Latest updates and changes
- **Quick Actions**: Fast shortcuts to common tasks
- **Role-Based View**: Different information based on your role

### Campaign Statistics

1. **Go to Campaigns**
2. **Click on Campaign Name**
3. **View Stats**:
   - Total leads in campaign
   - Leads by status
   - Team member performance
   - Conversion funnel

### Sales Funnel Analysis

Understand your sales pipeline:

1. **Go to Dashboard**
2. **Look for "Sales Funnel"**
3. **View**:
   - Leads at each stage
   - Conversion rates between stages
   - Bottlenecks in your pipeline

### User Conversion Ratios

See individual team member performance:

1. **Dashboard or Analytics Section**
2. **Look for "User Performance" or "Conversion Ratios"**
3. **View**:
   - Leads assigned to each user
   - Conversion rates per user
   - Filter by date range
   - Compare team member effectiveness

### Date Range Filtering

Most analytics support date filtering:

1. **Click Date Range Selector**
2. **Choose**:
   - Today
   - This week
   - This month
   - Custom date range
3. **Apply**: Data updates to match your selection

---

## Forms & Lead Capture

### Why Use Forms?

Forms automatically capture leads from your website without manual entry:

- **24/7 Capture**: Get leads anytime
- **Automatic Tracking**: Links submissions to campaigns
- **Qualifying Data**: Ask custom questions in the form
- **Effortless**: No manual data entry needed

### Creating a Form

1. **Go to Campaign**: Select the campaign
2. **Go to Forms**: Look for "Manage Forms" or "Forms" section
3. **Click "Create Form"**
4. **Form Details**:
   - **Title**: Name of the form (e.g., "Contact Us", "Product Inquiry")
   - **Description**: What is this form for?

5. **Add Fields**:
   - Click "Add Field"
   - **Field Name**: e.g., "Name", "Email", "Company"
   - **Field Type**: Text, email, phone, dropdown, textarea, etc.
   - **Required**: Check if this field is mandatory
   - **Add More**: Add all needed fields

6. **Click "Create"**: Form is ready

### Publishing Your Form

1. **Go to Forms**
2. **Click on Form Name**
3. **Click "Get Public Link"** or "Publish"
4. **Copy URL**: Share this link on your website, email, or social media
5. **Unique URL**: Each form has a unique slug (e.g., `muxro.com/forms/contact-us-2024`)

### Viewing Form Submissions

1. **Go to Campaign → Forms**
2. **Click on the Form**
3. **View Submissions**: See all completed form responses
4. **Each Submission**:
   - Shows all entered data
   - Date submitted
   - Linked lead (if created)

### Converting Form Submissions to Leads

1. **Go to Form Submissions**
2. **Click on Submission**
3. **Click "Convert to Lead"** or similar option
4. **Lead Details**:
   - Form data is pre-filled
   - Add additional information if needed
   - Assign to a team member
5. **Click "Create Lead"**: Submission becomes a lead in your campaign

---

## Bulk Operations

### Importing Multiple Leads at Once

MuxRo supports bulk import via CSV or JSON files:

#### CSV Import

1. **Prepare Your File**:
   ```
   Name,Email,Phone,Company,Custom Field
   John Doe,john@example.com,555-0001,ABC Corp,Value1
   Jane Smith,jane@example.com,555-0002,XYZ Inc,Value2
   ```
   - Header row with field names
   - One lead per row

2. **In MuxRo**:
   - Go to Campaign
   - Look for "Bulk Import" or "Import Leads"
   - Click "Import CSV"
   - Select your file
   - Click "Upload"

3. **Review Mapping**:
   - Confirm which file columns match which lead fields
   - Adjust if needed
   - Click "Import"

#### JSON Import

For more complex data:

1. **Prepare Your File**:
   ```json
   [
     {
       "name": "John Doe",
       "email": "john@example.com",
       "phone": "555-0001",
       "customData": { "company": "ABC Corp" }
     }
   ]
   ```

2. **In MuxRo**:
   - Go to Campaign → Bulk Import
   - Click "Import JSON"
   - Select your file
   - Click "Upload"

### Auto-Assignment with Round-Robin

1. **During Import**: Enable "Round-Robin Assignment"
2. **Effect**: Leads are automatically distributed evenly among team members
3. **Example**: 10 leads distributed to 2 users = 5 leads each

### Import Progress & Status

- View import progress in real-time
- See success count and any errors
- Failed rows are shown with error messages
- Retry or fix and re-import

---

## Notifications

### What are Notifications?

Notifications keep your team informed about important follow-ups:

- **Overdue**: Follow-ups past their due date
- **Today**: Follow-ups due today
- **Tomorrow**: Follow-ups due tomorrow
- **Warning**: Other important alerts

### Viewing Notifications

1. **Click Bell Icon**: Usually in the top bar
2. **View Pending Notifications**: All recent notifications
3. **Click Notification**: Goes to related lead/follow-up

### Notification Types

| Type | When | Action |
|------|------|--------|
| **Overdue** | Follow-up is past due date | Urgent action needed |
| **Today** | Follow-up due today | Plan your day |
| **Tomorrow** | Follow-up due tomorrow | Prepare in advance |
| **Warning** | Other important alerts | Review details |

### Managing Notifications

**Mark as Read:**
1. Click on notification
2. Read the details
3. Click "Mark as Read"

**Mark All as Read:**
1. Go to Notifications section
2. Click "Mark All as Read"
3. All notifications cleared from pending

**Notification Preferences:**
- Notifications prevent duplicates (one per user per follow-up)
- Automatically generated when follow-ups are created or due

---

## Integrations

### Connecting Third-Party Services

MuxRo integrates with popular platforms to streamline lead generation:

### Indiamart Integration

Automatically fetch leads from Indiamart marketplace:

**Setup:**
1. Go to Integrations section
2. Click "Indiamart"
3. Connect your Indiamart account
4. Authorize MuxRo access

**Fetching Leads:**
1. Go to Campaign
2. Click "Import from Indiamart"
3. Select date range
4. Click "Fetch Leads"
5. Leads are automatically added to campaign

**Benefits:**
- Real-time lead synchronization
- No manual data entry
- Automatic lead assignment available

### Process Sutra Integration

Trigger workflow automation with Process Sutra:

**Setup:**
1. Go to Integrations section
2. Click "Process Sutra"
3. Connect your Process Sutra account
4. Authorize workflow triggers

**Triggering Workflows:**
1. Go to Lead or Follow-up
2. Click "Trigger Workflow"
3. Select desired Process Sutra workflow
4. Workflow executes automatically

**Use Cases:**
- Send confirmation emails
- Create calendar events
- Generate documents
- Notify external systems

---

## Best Practices

### Lead Management

1. **Keep Data Updated**: Regularly update lead information
2. **Use Custom Fields**: Tailor campaigns to your specific needs
3. **Mark DND Appropriately**: Respect customer preferences
4. **Standardize Sources**: Consistent source tracking for analysis
5. **Document Everything**: Use remarks and follow-up notes

### Campaign Organization

1. **One Campaign per Initiative**: Keep campaigns focused
2. **Define Clear Stages**: Create meaningful status pipeline
3. **Assign Team Members Early**: Users know their responsibilities
4. **Name Consistently**: Use naming conventions (e.g., "Q3 2024 - Product Launch")

### Follow-up Management

1. **Schedule Promptly**: Create follow-ups when discussing leads
2. **Be Specific**: Clear remarks about what needs to happen
3. **Set Realistic Dates**: Achievable deadlines
4. **Complete on Time**: Respect scheduled follow-ups
5. **Review Regularly**: Check upcoming and overdue follow-ups

### Team Collaboration

1. **Assign Clearly**: One person per lead (the "doer")
2. **Use Remarks**: Communicate via follow-up notes
3. **Respect DND**: Honor do-not-disturb flags
4. **Monitor Performance**: Use dashboards to identify coaching opportunities
5. **Share Information**: Document important decisions

### Analytics & Reporting

1. **Review Regularly**: Check dashboards weekly
2. **Identify Trends**: Look for patterns in conversion rates
3. **Benchmark Users**: Compare team member performance
4. **Adjust Pipeline**: Update stages if they're not working
5. **Set Goals**: Use metrics to motivate team

---

## FAQs

### General Questions

**Q: How many campaigns can I have?**
A: Unlimited campaigns. Organize by marketing initiative, product, or region.

**Q: Can I download lead data?**
A: Yes, most views support export. Look for "Export" or download options in tables.

**Q: What happens to data if a user leaves?**
A: Their leads can be reassigned to other team members. Admin can reassign in bulk.

### Campaign & Lead Questions

**Q: Can a lead be in multiple campaigns?**
A: No, each lead belongs to one campaign. Use custom fields to track relationships.

**Q: Can I change a campaign's status pipeline?**
A: Yes, add or modify statuses anytime. It won't affect existing lead statuses.

**Q: How do I handle duplicate leads?**
A: Identify duplicates, merge manually by transferring data, or delete if truly duplicate.

### Follow-up & Scheduling

**Q: What time zone does the system use?**
A: Check your system settings. Ensure all users have consistent time zone settings.

**Q: Can I set recurring follow-ups?**
A: Currently, create one follow-up at a time. Set next follow-up when completing current one.

**Q: What happens if I miss a follow-up deadline?**
A: It appears as "Overdue" in notifications. Update follow-up date or mark as completed.

### Technical Questions

**Q: Is my data secure?**
A: Yes, passwords are encrypted, sessions use secure httpOnly cookies, and data is encrypted at rest.

**Q: How often is data backed up?**
A: Contact your admin for backup schedule. Enterprise plans include regular backups.

**Q: What if I forget my password?**
A: Contact your admin to reset your password.

### Troubleshooting

**Q: Why can't I see a campaign?**
A: You may not be assigned to it. Ask your admin to add you to the campaign team.

**Q: My follow-up notification disappeared. Where is it?**
A: It may have been marked as read. Check "Notifications" or go directly to the lead.

**Q: Why is form submission not creating a lead automatically?**
A: You may need to manually convert submissions to leads. Go to the form and convert them.

**Q: Import failed with errors. What do I do?**
A: Review error messages, fix data format, and retry. Common issues: missing required fields or incorrect data types.

---

## Getting Help

- **Admin Support**: Contact your system administrator
- **Technical Issues**: Check your internet connection and browser compatibility
- **Feature Questions**: Refer to relevant section in this guide or ask your team lead
- **Security Concerns**: Notify your admin immediately

---

## Summary

MuxRo Ultimate CRM empowers your team to:

✅ Organize customer relationships in campaigns  
✅ Track leads through customizable sales pipelines  
✅ Schedule and manage follow-ups  
✅ Capture leads automatically via forms  
✅ Import and manage bulk lead lists  
✅ Monitor performance with real-time analytics  
✅ Integrate with third-party platforms  
✅ Collaborate efficiently with your team  

Start by creating your first campaign and adding your team members. Then begin capturing and managing leads to drive your business forward!

---

**Last Updated**: July 2024  
**Version**: 1.0  
**Contact**: Support Team
