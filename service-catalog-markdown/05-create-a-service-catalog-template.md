# Create a Service Catalog Template

**Source:** https://docs.motadata.com/serviceops-docs/technician-user-guide/admin-section/service-catalog/create-a-service-catalog-template
**Downloaded:** 2025-01-28

---

# Create a Service Catalog Template

A Service Catalog Template allows you to define a service within a particular Service Category. Templates are configured with respect to the following elements:

- Form fields capturing custom data
- Specific workflow automating request lifecycle handling
- Service Level Agreements controlling response and resolution times
- Approval workflow adding supervision
- Associated tasks for requests
- Scenarios performing tasks for requests
- Form rules showing/hiding or enabling/disabling fields
- Email notifications specific to the template
- Custom rules enforcing organizational compliance
- Print templates for request printing

## Service Catalog Form

Create forms by dragging and dropping required fields from the left sidebar. Two field types are available:

- **Custom Fields**: Can be added, edited, renamed, and removed as needed
- **System Fields**: Cannot be renamed but can be added, edited, or removed

Once fields are added, you can reorder them, adjust width, duplicate custom fields, edit, or remove them.

## Workflow

Workflow automation channels tickets through predefined rules based on ticket details. Template-specific workflows:

- Work exclusively for requests created using the template
- Execute parallel to generic admin workflows
- Initiate based on trigger events

Create workflows by entering a name, adding trigger events and conditions, then selecting actions.

## SLA

Service Level Agreements define commitments between requestors and IT service providers, determining urgency, response times, and resolution timeframes.

**Implementation Behavior:**

- Template SLAs apply exclusively to requests using the template
- Set response and resolution times with escalation rules for violations
- Template SLAs override system SLAs

## Approval Workflow

Approval workflows automate the approval process for requests. Template-specific approval workflows create approvals and add approvers based on conditions.

## Tasks

Predefined tasks can be organized stage-wise, with up to 15 stages available. Tasks at one stage must be completed before advancing to the next.

## Scenario

Create scenarios containing conditions and actions that modify requests. Multiple scenarios can exist within a template, each with independent configurations.

## Service Model

Transition models automatically change request status based on conditions. For example, automatically transition from "Open" to "InProgress" when an assignee is assigned.

To create a service model:

1. Navigate to Admin > Service Catalog > Service > Service Model
2. Click **Create Model**
3. Enter the model name and description
4. Add state transitions and condition groups
5. Click **Create**

**Note:** "You can create only one Service Model. Also, the model created here will be used for all the Service Requests related to this service."

## Service Catalog Form Rules

Form rules manage field behavior based on conditions, making fields mandatory/optional, visible/hidden, or enabled/disabled.

## Email Notifications

Add template-specific email notifications from available default notifications, which can be modified as needed.

## Custom Rules

Custom rules enforce organizational compliance during request processing. They ensure service request attribute changes are accompanied by appropriate comments or notes.

## Print Template

Create print templates for individual service requests. Template-specific templates and request management templates are available when printing.

To create a print template:

1. Click **Create Print Template**
2. Enter template name and description
3. Create the print format, using placeholders for request details
4. Click **Create** and enable the template for use
