import { describe, it, expect } from 'vitest';
import type { SepaDirectDebitTransaction, SepaPain008Config } from '@/lib/sepa/pain008-generator';
import {
  generatePain008Xml,
  validatePain008Xml,
  getPain008FileName,
  getPain008EmailSubject,
  getPain008EmailBody,
} from '@/lib/sepa/pain008-generator';

describe('Pain.008 XML Generator', () => {
  const mockTransaction: SepaDirectDebitTransaction = {
    paymentId: 'pay-123',
    mandateId: 'mand-456',
    mandateReference: 'SWINGZ-club1-1714567890123',
    creditorId: 'DE98ZZZ09999999999',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    accountHolderName: 'Max Mustermann',
    amount: 100.0,
    currency: 'EUR',
    paymentDate: '2026-05-15',
    endToEndId: 'SWINGZ-PAY-202605-00001',
    remittanceInformation: 'Rechnung INV-202605-00001',
  };

  const mockConfig: SepaPain008Config = {
    creditorName: 'SWINGZ Tennis Club',
    creditorAccountIban: 'DE75370400440532013000',
    creditorAccountBic: 'COBADEFFXXX',
    creditorId: 'DE98ZZZ09999999999',
    creditorAddress: {
      street: 'Musterstraße 123',
      city: 'Musterstadt',
      postalCode: '12345',
      country: 'DE',
    },
    executionDate: '2026-05-15',
    batchBooking: true,
  };

  describe('generatePain008Xml', () => {
    it('should generate valid Pain.008 XML', () => {
      const xml = generatePain008Xml([mockTransaction], mockConfig);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('urn:iso:std:iso:20022:tech:xsd:pain.008.001.02');
      expect(xml).toContain('<CstmrDrctDbtInitn>');
      expect(xml).toContain('<GrpHdr>');
      expect(xml).toContain('<PmtInf>');
      expect(xml).toContain('<DrctDbtTxInf>');
    });

    it('should include transaction details', () => {
      const xml = generatePain008Xml([mockTransaction], mockConfig);

      expect(xml).toContain(mockTransaction.iban);
      expect(xml).toContain(mockTransaction.accountHolderName);
      expect(xml).toContain(mockTransaction.amount.toFixed(2));
      expect(xml).toContain(mockTransaction.mandateReference);
      expect(xml).toContain(mockTransaction.creditorId);
    });

    it('should include creditor information', () => {
      const xml = generatePain008Xml([mockTransaction], mockConfig);

      expect(xml).toContain(mockConfig.creditorName);
      expect(xml).toContain(mockConfig.creditorAccountIban);
      expect(xml).toContain(mockConfig.creditorId);
    });

    it('should handle multiple transactions', () => {
      const transactions = [
        mockTransaction,
        {
          ...mockTransaction,
          paymentId: 'pay-456',
          iban: 'DE89370400440532013001',
          accountHolderName: 'Anna Schmidt',
          amount: 50.0,
        },
      ];

      const xml = generatePain008Xml(transactions, mockConfig);

      expect(xml).toContain('<NbOfTxs>2</NbOfTxs>');
      expect(xml).toContain('Max Mustermann');
      expect(xml).toContain('Anna Schmidt');
    });

    it('should calculate control sum correctly', () => {
      const transactions = [
        mockTransaction,
        {
          ...mockTransaction,
          paymentId: 'pay-456',
          amount: 50.0,
        },
      ];

      const xml = generatePain008Xml(transactions, mockConfig);

      expect(xml).toContain('<CtrlSum>150.00</CtrlSum>');
    });

    it('should handle optional BIC', () => {
      const transactionWithoutBic = {
        ...mockTransaction,
        bic: undefined,
      };

      const xml = generatePain008Xml([transactionWithoutBic], mockConfig);

      expect(xml).toContain('NOTPROVIDED');
    });

    it('should handle optional remittance information', () => {
      const transactionWithoutRemittance = {
        ...mockTransaction,
        remittanceInformation: undefined,
      };

      const xml = generatePain008Xml([transactionWithoutRemittance], mockConfig);

      expect(xml).not.toContain('<RmtInf>');
    });

    it('should escape XML special characters', () => {
      const transactionWithSpecialChars = {
        ...mockTransaction,
        accountHolderName: 'Max & Müller <Test>',
      };

      const xml = generatePain008Xml([transactionWithSpecialChars], mockConfig);

      expect(xml).toContain('Max & Müller <Test>');
    });
  });

  describe('validatePain008Xml', () => {
    it('should validate correct XML', () => {
      const xml = generatePain008Xml([mockTransaction], mockConfig);
      const result = validatePain008Xml(xml);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing XML declaration', () => {
      const invalidXml = '<Document></Document>';
      const result = validatePain008Xml(invalidXml);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing XML declaration');
    });

    it('should detect invalid namespace', () => {
      const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:invalid:namespace">
</Document>`;
      const result = validatePain008Xml(invalidXml);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid or missing Pain.008 namespace');
    });

    it('should detect missing required elements', () => {
      const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
</Document>`;
      const result = validatePain008Xml(invalidXml);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getPain008FileName', () => {
    it('should generate correct filename', () => {
      const date = new Date('2026-05-15');
      const fileName = getPain008FileName(date);

      expect(fileName).toBe('SEPA-DD-20260515.xml');
    });

    it('should use current date if not provided', () => {
      const fileName = getPain008FileName();
      const expectedDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

      expect(fileName).toContain(expectedDate);
      expect(fileName.endsWith('.xml')).toBe(true);
    });
  });

  describe('getPain008EmailSubject', () => {
    it('should generate correct email subject', () => {
      const subject = getPain008EmailSubject(5, 500.0);

      expect(subject).toContain('5');
      expect(subject).toContain('500,00');
      expect(subject).toContain('SEPA-Lastschrift Export');
    });
  });

  describe('getPain008EmailBody', () => {
    it('should generate correct email body', () => {
      const body = getPain008EmailBody(5, 500.0, '2026-05-15', 'SWINGZ Tennis Club');

      expect(body).toContain('5');
      expect(body).toContain('500,00');
      expect(body).toContain('15.5.2026');
      expect(body).toContain('SWINGZ Tennis Club');
      expect(body).toContain('Pain.008 XML');
    });

    it('should include important notes', () => {
      const body = getPain008EmailBody(1, 100.0, '2026-05-15', 'Test Club');

      expect(body).toContain('Vorlaufzeiten');
      expect(body).toContain('Mandate');
    });
  });
});
