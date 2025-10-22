# Studio Booking System

A full-stack booking system for rehearsal spaces with Stripe payments, Google Calendar sync, and email notifications.

## 🚀 Setup Instructions

### 1. Supabase Setup

When you're ready to connect Supabase:

1. Click the **Integrations** button in the top-right corner
2. Select **Supabase** from the integrations list
3. Click **Connect** and authorize your Supabase account
4. Select your organization and project (or create new ones)
5. Wait for the connection to complete

After connecting, run the migration file in your Supabase SQL editor:
- Navigate to `supabase/migrations/001_initial_schema.sql`
- Copy the SQL and execute it in your Supabase project

### 2. Environment Variables

Configure these in your Supabase Edge Functions and project settings:

**Supabase:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Stripe:**
- `VITE_STRIPE_PUBLISHABLE_KEY` (frontend)
- `STRIPE_SECRET_KEY` (Edge Functions)
- `STRIPE_WEBHOOK_SECRET` (from Stripe Dashboard)

**Google Calendar:**
- `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` (full JSON with service account credentials)

**Resend (Email):**
- `RESEND_API_KEY`

### 3. Deploy Edge Functions

Deploy the Supabase Edge Functions:

```bash
supabase functions deploy process-booking
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy get-calendar-events
```

### 4. Stripe Webhook Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select event: `payment_intent.succeeded`
4. Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

### 5. Google Calendar Setup

1. Create a Google Cloud Project
2. Enable Google Calendar API
3. Create a Service Account
4. Download the JSON credentials
5. Share each room's calendar with the service account email (with "Make changes to events" permission)
6. Add the full JSON to `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` environment variable

## 🎨 Features

- **Dark UI with Purple Accents**: Glassmorphism design with liquid-glass cards
- **Room Booking**: Select from 4 rehearsal spaces
- **Date/Time Selection**: Hourly slots from 07:00-22:00
- **Availability Checking**: Syncs with Google Calendar + internal bookings
- **15-min Buffer**: Automatic buffer between bookings
- **Stripe Payments**: Secure payment processing
- **Email Notifications**: Confirmation emails via Resend
- **Invoice Generation**: Automatic HTML invoices
- **Customer Portal**: View/manage bookings
- **Admin Portal**: Manage rooms, bookings, and invoices

## 📱 Pages

- `/` - Home with room listings
- `/room/:id` - Room details
- `/booking/:roomId` - Booking flow (date/time → details → payment)
- `/confirmation/:bookingId` - Booking confirmation
- `/portal` - Customer portal
- `/admin` - Admin dashboard

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- Service role key used only in Edge Functions
- Stripe webhook signature verification
- Google service account authentication

## 🌍 Timezone

All times stored in UTC, displayed in Europe/London timezone.

## 📝 Notes

- Currently using localStorage for quick prototyping
- Supabase integration ready - follow setup steps above
- Mock authentication included (replace with Supabase Auth in production)
