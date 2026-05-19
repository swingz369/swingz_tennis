import { describe, it, expect } from 'vitest'

function calcPreview(entries: any[], feeConfigs: any[]) {
  return entries.map(entry => {
    const fee = feeConfigs.find(f => {
      if (!f.conditions) return true
      if (f.conditions.trainingGroup && f.conditions.trainingGroup !== entry.group_id) return false
      return true
    }) ?? null
    return { memberId: entry.member_id, amount: fee?.amount ?? 0, installments: fee?.billing_cycle === 'installment' ? (fee.installment_count ?? 1) : 1 }
  })
}

describe('billing preview calculation', () => {
  it('assigns amount from matching fee config', () => {
    expect(calcPreview([{ member_id: 'm1', group_id: 'g1' }], [{ amount: 120, billing_cycle: 'season', conditions: { trainingGroup: 'g1' } }])[0].amount).toBe(120)
  })
  it('returns 0 when no config matches', () => {
    expect(calcPreview([{ member_id: 'm1', group_id: 'g2' }], [{ amount: 120, billing_cycle: 'season', conditions: { trainingGroup: 'g1' } }])[0].amount).toBe(0)
  })
  it('sets installments from installment_count', () => {
    expect(calcPreview([{ member_id: 'm1', group_id: 'g1' }], [{ amount: 300, billing_cycle: 'installment', installment_count: 3, conditions: null }])[0].installments).toBe(3)
  })
  it('uses global fee config when conditions null', () => {
    expect(calcPreview([{ member_id: 'm1', group_id: 'any' }], [{ amount: 80, billing_cycle: 'season', conditions: null }])[0].amount).toBe(80)
  })
})
