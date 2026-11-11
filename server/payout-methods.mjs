import { z } from 'zod';
import { HttpError } from './security.mjs';

const clean = (max) => z.string().trim().max(max);
const forbidden = /\b(password|passcode|otp|cvv|cvc|pin)\b|card\s*number|one[- ]time\s*(code|password)/i;
export const questionSchema = z.object({
  id: clean(40).regex(/^[a-z][a-z0-9_]*$/), label: clean(100).min(2),
  type: z.enum(['text', 'email', 'number', 'select', 'textarea']), required: z.boolean(),
  placeholder: clean(160).default(''), help: clean(240).default(''),
  validation: z.enum(['none', 'email', 'upi', 'ifsc', 'iban']).default('none'),
  sensitive: z.boolean().default(false), purpose: z.enum(['payee', 'destination', 'other']).default('other'),
  options: z.array(clean(80).min(1)).max(20).default([]),
}).superRefine((value, ctx) => {
  if (forbidden.test(`${value.label} ${value.placeholder}`)) ctx.addIssue({ code: 'custom', message: 'Do not ask members for passwords, PINs, card numbers, CVVs or one-time codes.' });
  if (value.type === 'select' && value.options.length === 0) ctx.addIssue({ code: 'custom', message: 'A choice question needs at least one option.' });
});
export const payoutMethodSchema = z.object({
  id: clean(70).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: clean(70).min(2),
  description: clean(240).default(''), instructions: clean(800).default(''),
  status: z.enum(['active', 'retired']), minimum: z.number().min(0).max(100000),
  currency: clean(3).regex(/^[A-Z]{3}$/), order: z.number().int().min(0).max(1000).default(0),
  questions: z.array(questionSchema).min(1).max(8),
  version: z.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  if (new Set(value.questions.map((question) => question.id)).size !== value.questions.length) ctx.addIssue({ code: 'custom', message: 'Each question must have a unique ID.' });
});

const payee = { id: 'payee_name', label: 'Account holder / payee name', type: 'text', required: true, purpose: 'payee', sensitive: false, validation: 'none', placeholder: 'Full name on the receiving account', help: '', options: [] };
export const defaultPayoutMethods = [
  { id: 'paypal', name: 'PayPal', description: 'Receive your cashback in your PayPal account.', instructions: 'Use the email address registered to your PayPal account.', status: 'active', minimum: 0, currency: 'USD', order: 0, questions: [payee, { id: 'paypal_email', label: 'PayPal email address', type: 'email', required: true, purpose: 'destination', validation: 'email', sensitive: true, placeholder: 'you@example.com', help: '', options: [] }] },
  { id: 'upi', name: 'UPI', description: 'For supported Indian UPI accounts.', instructions: 'Enter your UPI ID, not a mobile banking PIN. Any currency conversion will be confirmed before payment.', status: 'active', minimum: 0, currency: 'INR', order: 1, questions: [payee, { id: 'upi_id', label: 'UPI ID', type: 'text', required: true, purpose: 'destination', validation: 'upi', sensitive: true, placeholder: 'yourname@bank', help: '', options: [] }] },
  { id: 'bank-transfer', name: 'Bank transfer', description: 'Transfer to your bank account after review.', instructions: 'Check the receiving account details carefully. Your balance is shown in USD; settlement currency and conversion are confirmed by the team.', status: 'active', minimum: 0, currency: 'USD', order: 2, questions: [payee,
    { id: 'bank_name', label: 'Bank name', type: 'text', required: true, purpose: 'other', validation: 'none', sensitive: false, placeholder: 'Name of the receiving bank', help: '', options: [] },
    { id: 'account_number', label: 'Bank account number / IBAN', type: 'text', required: true, purpose: 'destination', validation: 'none', sensitive: true, placeholder: 'Receiving account number', help: 'Do not enter a debit or credit card number.', options: [] },
    { id: 'routing_code', label: 'IFSC / SWIFT / routing code', type: 'text', required: true, purpose: 'other', validation: 'none', sensitive: true, placeholder: 'Bank transfer routing code', help: '', options: [] },
  ] },
].map((method) => ({ ...method, version: 1, updatedAt: new Date(0).toISOString() }));

export async function seedPayoutMethods(store) {
  await store.db.transaction(async () => {
    if (await store.db.prepare('SELECT value FROM app_meta WHERE key=?').get('payout_methods_v1')) return;
    for (const method of defaultPayoutMethods) await store.put('payout_methods', { ...method, updatedAt: new Date().toISOString() });
    await store.db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?)').run('payout_methods_v1', '1');
  })();
}
export async function availablePayoutMethods(store, all = false) {
  return (await store.list('payout_methods')).filter((method) => all || method.status === 'active').sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
export function validateAnswers(method, submitted) {
  const answers = {};
  const allowed = new Set(method.questions.map((question) => question.id));
  if (Object.keys(submitted).some((key) => !allowed.has(key))) throw new HttpError(409, 'The payout form has changed. Close it and choose the payout method again.');
  for (const question of method.questions) {
    const value = String(submitted[question.id] ?? '').trim();
    if (value.length > 500) throw new HttpError(400, `${question.label} is too long.`);
    if (question.required && !value) throw new HttpError(400, `${question.label} is required.`);
    if (value) {
      if ((question.type === 'email' || question.validation === 'email') && !/^\S+@\S+\.\S+$/.test(value)) throw new HttpError(400, `Enter a valid ${question.label.toLowerCase()}.`);
      if (question.validation === 'upi' && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(value)) throw new HttpError(400, 'Enter a valid UPI ID.');
      if (question.validation === 'ifsc' && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(value)) throw new HttpError(400, 'Enter a valid 11-character IFSC code.');
      if (question.validation === 'iban' && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/i.test(value.replace(/\s/g, ''))) throw new HttpError(400, 'Enter a valid IBAN.');
      if (question.type === 'number' && !Number.isFinite(Number(value))) throw new HttpError(400, `${question.label} must be a number.`);
      if (question.type === 'select' && !question.options.includes(value)) throw new HttpError(400, `Choose a valid option for ${question.label}.`);
    }
    answers[question.id] = value;
  }
  return answers;
}