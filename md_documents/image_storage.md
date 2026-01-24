Best storage design
Recommended architecture

Customer is asked (via SMS) to reply with a photo (MMS)

Twilio receives inbound MMS and hits your webhook

Your backend:

Reads the Twilio MediaUrl

Downloads the image

Stores it in S3 (private bucket)

Saves an S3 object key/URL in your DB (linked to job_id / request_session_id)

Admin UI shows the photo using a short-lived presigned URL from S3

Why this is best:

Twilio media retention is not “forever” and is configurable, with media commonly referenced as being deleted after a retention window (e.g., up to ~13 months by default depending on settings).

S3 is extremely cheap for small images and gives you lifecycle policies (delete after N days, or move to cheaper storage).

Security and privacy defaults (do this)

Store in private S3 bucket

Encrypt at rest (S3 default encryption)

Never store public S3 URLs

Admin UI requests GET /api/admin/jobs/{id}/photo-url → backend returns a presigned URL valid for 1–5 minutes

Data model (minimal)

photos table:

id, job_id (or request_session_id)

source = "twilio_mms"

twilio_message_sid, twilio_media_sid (optional)

s3_bucket, s3_key

content_type, bytes, created_at

Twilio MMS: how the SMS photo intake works
UX pattern (simple)

After the user selects “House” and you need a photo, show:

“We’ll text you a number—reply to that text with a photo of your lock.”

Then send them an SMS:

“Reply to this message with a clear photo of your door lock (include the handle + lock).”

They reply with an MMS image → your Twilio webhook receives it.

Costs on Twilio

For US long-code messaging, Twilio lists (pay-as-you-go):

Inbound MMS: $0.0165 per message

Outbound MMS: $0.0220 per message

SMS (in/out): $0.0083 per message

Also note: US A2P 10DLC registration/campaign fees can apply on top of base messaging costs.

Important nuance: if carriers split a large MMS, it can count as multiple messages. (So encourage 1 photo, not 6.)