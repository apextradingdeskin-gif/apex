# Purchase Tracking And Payout Operations

## How You Know A Purchase Happened

APEX cannot see another company's checkout just because your code or link was
displayed. These are different events:

1. A **link activation** records a signed-in member's click and a unique click ID.
2. A **member submission** records an order claimed by a member, pending review.
3. A **partner receipt** comes from an actual affiliate report or signed webhook.

The admin **Attribution** tab keeps those events separate. It shows matched
orders, unmatched receipts, the coupon reported, and the evidence source.
The **Purchases** tab controls cashback approval. Receiving a receipt does not
automatically approve a reward or initiate a payout.

## Set Up A Partner

1. Obtain the real affiliate URL and coupon assigned to APEX by that firm. Codes
   inherited from reference/example content are not evidence of a partnership.
2. In **Admin > Prop firms > Edit**, save the partner affiliate URL and the
   provider-supported click/sub-ID query parameter. Do not use the parameter
   that holds the owner's affiliate identity, such as `ref` or `afmc`.
3. In **Admin > Attribution > Partner setup**, select the firm and create a
   signing key. Copy it immediately and share it only with the partner's server
   or a trusted integration adapter. It is not returned in snapshots or exports.
4. Ask the provider to send actual sale/refund events to the displayed HTTPS
   endpoint, following the APEX protocol below. An adapter is required if their
   native postback format differs.
5. Verify that a signed test event arrives. "Key created" means configured, not
   connected; the UI separately displays the last signed report received.

If a firm cannot send postbacks, verify its affiliate dashboard manually and use
**Record partner sale**. The UI labels this evidence as a manual partner report.

## APEX Webhook Contract

This is a custom APEX contract, not the native API of a named prop firm.

- POST `/api/partners/<firm-id>/conversions`
- Content-Type: `application/json`
- `X-Apex-Timestamp`: Unix timestamp in seconds, within five minutes.
- `X-Apex-Signature`: hexadecimal HMAC-SHA256 using the per-firm signing key.
- Signed bytes: the timestamp, a dot (`.`), then the exact raw JSON body bytes.
- Example body:

```json
{
  "eventId": "partner-event-123",
  "orderId": "partner-order-456",
  "amount": 199.00,
  "currency": "USD",
  "status": "completed",
  "purchasedAt": "2026-01-01T12:00:00.000Z",
  "clickId": "the-click-id-returned-in-the-subid-parameter",
  "couponCode": "YOUR-ACTUAL-PARTNER-CODE"
}
```

Use `status: "refunded"` and a new stable `eventId` for a refund. Every event
must use a stable unique ID. Identical retries are acknowledged without a
duplicate order; reusing an event ID for different data is rejected.

Matching supports a valid click ID, `memberCode` (the member's APEX referral code),
or `buyerEmail` from the partner checkout. Coupon codes shared by many customers
cannot uniquely identify a member. A member's own order claim is not an
independent buyer identifier. Conflicts stay unmatched for human review.

Only USD reporting is supported by this contract. Do not label another currency
as USD. Agree on conversion/reporting terms with the provider before integrating.
Partner receipt amounts that differ from approved orders are flagged; reconcile
the verified amount in Purchases before approving or paying additional rewards.

## Payout Workflow

Members now use **Dashboard > Cashback > Request payout**. This is a real API
request saved to SQLite, not a `mailto:` button.

- Only available approved cashback can be requested.
- Pending verification balances cannot be withdrawn.
- A request must meet the configured minimum payout.
- Requested/processing amounts are reserved and cannot be requested again.
- Repeated submissions with the same request key do not create another payout.
- A member can cancel a request only before processing starts.
- An admin reviews requests in **Payout requests** and can mark them processing,
  reject them with a reason, or mark them paid with a transaction reference.
- A paid payout is final in this workflow and cannot be processed twice.

APEX does not initiate a bank, PayPal or UPI transfer. The administrator transfers
funds using the agreed provider, verifies completion, then records the reference.
All balances are denominated in USD; any local-currency conversion and banking
instructions must be confirmed separately. Do not request bank passwords, PINs,
OTPs or card numbers in this website.

## Editable Links And Live Counts

**Admin > Settings & data > Social media & contact links** updates X, Instagram,
Discord and the support email across the site. Social URLs must use the correct
platform's HTTPS domain. Empty social URLs are hidden.

The hero count and reward-rate claims use active published firm records, not a
hard-coded number. Admin changes appear immediately in that session. Other open
sessions refresh their snapshot on window focus and every 30 seconds.

These workflows are implemented and locally tested. A live domain, HTTPS,
partner-issued affiliate credentials and actual provider postbacks must still
be configured by the website owner.