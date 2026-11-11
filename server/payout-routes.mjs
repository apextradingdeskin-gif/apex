import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpError, tokenHash } from './security.mjs';
import { payoutRequest, payoutUpdate } from './validation.mjs';
import { cashbackBalance, payoutCommitments } from './finance.mjs';
import { availablePayoutMethods, payoutMethodSchema, validateAnswers } from './payout-methods.mjs';

const cents = (value) => Math.round(value * 100);
const masked = (value) => value ? `Ending ${value.slice(-4)}` : 'Details provided';

export function mountPayoutRoutes(app, store, { requireUser, audit, vault }) {
  app.post('/api/payouts', requireUser, async (req, res) => {
    const input = payoutRequest.parse(req.body); let duplicate = false;
    await store.db.transaction(async () => {
      const methods = await availablePayoutMethods(store);
      const method = methods.find((item) => input.methodId ? item.id === input.methodId : item.name === input.method);
      if (!method) throw new HttpError(409, 'This payout method is no longer available. Choose another method.');
      if (input.methodVersion !== undefined && input.methodVersion !== method.version) throw new HttpError(409, 'This payout method was updated. Close this form and open it again.');
      let submitted = input.answers;
      if (!submitted) {
        submitted = {};
        for (const question of method.questions) {
          if (question.purpose === 'payee') submitted[question.id] = input.payeeName || req.user.name;
          if (question.purpose === 'destination') submitted[question.id] = input.destination || '';
        }
      }
      const answers = validateAnswers(method, submitted);
      const fingerprint = tokenHash(JSON.stringify({ methodId: method.id, amount: input.amount, answers }));
      const existing = (await store.list('payouts', req.user.id)).find((item) => item.requestKey === input.requestKey);
      if (existing) {
        if (existing.fingerprint && existing.fingerprint !== fingerprint) throw new HttpError(409, 'This request key belongs to a different payout. Start a new request.');
        duplicate = true; return;
      }
      const minimum = Math.max((await store.settings()).minPayout, method.minimum);
      if (input.amount < minimum) throw new HttpError(400, `The minimum for ${method.name} is $${minimum.toFixed(2)}.`);
      if (cents(input.amount) > cents((await cashbackBalance(store, req.user.id)).available)) throw new HttpError(409, 'This amount exceeds your available approved cashback.');
      const payee = method.questions.find((question) => question.purpose === 'payee');
      const destination = method.questions.find((question) => question.purpose === 'destination') ?? method.questions[0];
      await store.put('payouts', {
        id: randomUUID(), userId: req.user.id, amount: cents(input.amount) / 100, currency: 'USD',
        methodId: method.id, method: method.name, methodSnapshot: method,
        payeeName: payee ? answers[payee.id] : req.user.name, destination: masked(answers[destination.id]),
        encryptedAnswers: vault.seal(answers), fingerprint, requestKey: input.requestKey,
        status: 'requested', createdAt: new Date().toISOString(),
      });
    })();
    res.status(duplicate ? 200 : 201).json({ ok: true, message: duplicate ? 'This payout request is already recorded.' : 'Payout request submitted. You can follow its progress in your dashboard.' });
  });
  app.delete('/api/payouts/:id', requireUser, async (req, res) => {
    await store.db.transaction(async () => {
      const item = await store.get('payouts', req.params.id);
      if (!item) throw new HttpError(404, 'Payout request not found.');
      if (item.userId !== req.user.id) throw new HttpError(403, 'This request belongs to another member.');
      if (item.status !== 'requested') throw new HttpError(409, 'Only a request that has not started processing can be cancelled.');
      await store.put('payouts', { ...item, status: 'cancelled', updatedAt: new Date().toISOString() });
    })();
    res.json({ ok: true, message: 'Payout cancelled. Reserved cashback is available again.' });
  });
  app.get('/api/admin/payouts/:id/details', async (req, res) => {
    const item = await store.get('payouts', req.params.id);
    if (!item) throw new HttpError(404, 'Payout request not found.');
    const answers = item.encryptedAnswers ? vault.open(item.encryptedAnswers) : {};
    await audit(req, 'Payout details viewed', item.id, 'Authorised access to private payment details.');
    res.json({ ...vault.publicRow(item), answers });
  });
  app.patch('/api/admin/payouts/:id', async (req, res) => {
    const patch = payoutUpdate.parse(req.body);
    await store.db.transaction(async () => {
      const item = await store.get('payouts', req.params.id);
      if (!item) throw new HttpError(404, 'Payout request not found.');
      if (!['requested', 'processing'].includes(item.status)) throw new HttpError(409, 'This payout is already closed.');
      if (patch.status === 'paid' && cents((await cashbackBalance(store, item.userId)).approved) < await payoutCommitments(store, item.userId)) throw new HttpError(409, 'Approved funds changed. Resolve the purchase discrepancy before recording payment.');
      await store.put('payouts', { ...item, ...patch, updatedAt: new Date().toISOString(), paidAt: patch.status === 'paid' ? new Date().toISOString() : undefined });
      await audit(req, 'Payout updated', item.id, `${item.status} to ${patch.status}; $${item.amount.toFixed(2)}.`);
    })();
    res.json({ ok: true, message: patch.status === 'paid' ? 'Payment reference saved and payout marked paid.' : 'Payout request updated.' });
  });
  app.put('/api/admin/payout-methods/:id', async (req, res) => {
    const definition = payoutMethodSchema.parse(req.body);
    if (definition.id !== req.params.id) throw new HttpError(400, 'The payout method ID does not match.');
    await store.db.transaction(async () => {
      const methods = await availablePayoutMethods(store, true);
      if (methods.some((item) => item.id !== definition.id && item.name.toLowerCase() === definition.name.toLowerCase())) throw new HttpError(409, 'Another payout method already uses this name.');
      const previous = await store.get('payout_methods', definition.id);
      if (previous && definition.version !== undefined && definition.version !== previous.version) throw new HttpError(409, 'This method changed while you were editing it. Reopen the editor and try again.');
      await store.put('payout_methods', { ...definition, version: (previous?.version ?? 0) + 1, updatedAt: new Date().toISOString() });
      await audit(req, previous ? 'Payout method edited' : 'Payout method created', definition.name, `${definition.status}; ${definition.questions.length} questions.`);
    })();
    res.json({ ok: true, message: 'Payout method saved.' });
  });
  app.delete('/api/admin/payout-methods/:id', async (req, res) => {
    await store.db.transaction(async () => {
      const method = await store.get('payout_methods', req.params.id);
      if (!method) throw new HttpError(404, 'Payout method not found.');
      if (method.status !== 'retired') throw new HttpError(409, 'Retire this method before deleting it.');
      const open = (await store.list('payouts')).some((item) => (item.methodId === method.id || (!item.methodId && item.method === method.name)) && ['requested', 'processing'].includes(item.status));
      if (open) throw new HttpError(409, 'Complete or reject this method\'s open payout requests before deleting it.');
      await store.remove('payout_methods', method.id);
      await audit(req, 'Payout method deleted', method.name, 'Historical request details were preserved.');
    })();
    res.json({ ok: true, message: 'Payout method removed. Historical requests are preserved.' });
  });
}