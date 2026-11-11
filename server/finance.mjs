import { HttpError } from './security.mjs';
const cents = (value) => Math.round(value * 100);
export async function cashbackBalance(store, userId) {
    const purchases = await store.list('purchases', userId);
    const eligible = (item) => item.verification !== 'refunded' && !item.amountMismatch;
    const approved = purchases.filter((item) => item.status === 'approved' && eligible(item)).reduce((sum, item) => sum + cents(item.cashbackAmount), 0);
    const legacyPaid = purchases.filter((item) => item.status === 'paid').reduce((sum, item) => sum + cents(item.cashbackAmount), 0);
    const pending = purchases.filter((item) => item.status === 'pending').reduce((sum, item) => sum + cents(item.cashbackAmount), 0);
    const payouts = await store.list('payouts', userId);
    const reserved = payouts.filter((item) => ['requested', 'processing'].includes(item.status)).reduce((sum, item) => sum + cents(item.amount), 0);
    const settled = payouts.filter((item) => item.status === 'paid').reduce((sum, item) => sum + cents(item.amount), 0);
    return { available: Math.max(0, approved - reserved - settled) / 100, pending: pending / 100, reserved: reserved / 100, paid: (legacyPaid + settled) / 100, approved: approved / 100, total: (pending + approved + legacyPaid) / 100 };
}
export async function payoutCommitments(store, userId) {
    return (await store.list('payouts', userId)).filter((item) => ['requested', 'processing', 'paid'].includes(item.status)).reduce((sum, item) => sum + cents(item.amount), 0);
}
export async function ensurePurchaseChangeCovered(store, next) {
    const approved = (await store.list('purchases', next.userId)).map((item) => item.id === next.id ? next : item)
        .filter((item) => item.status === 'approved' && item.verification !== 'refunded' && !item.amountMismatch)
        .reduce((sum, item) => sum + cents(item.cashbackAmount), 0);
    if (approved < await payoutCommitments(store, next.userId))
        throw new HttpError(409, 'This change would invalidate reserved or paid cashback. Review the related payout requests first.');
}
