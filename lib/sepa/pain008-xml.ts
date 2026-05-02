import { Payment, SepaMandate } from '../types/billing';

export interface SepaDirectDebitData {
  creditorId: string;
  creditorName: string;
  creditorIban: string;
  creditorBic: string;
  payments: Array<{
    paymentId: string;
    amount: number;
    currency: string;
    mandateId: string;
    mandateDate: string;
    debtorName: string;
    debtorIban: string;
    debtorBic?: string;
    description: string;
    executionDate: string;
  }>;
}

export function generatePain008Xml(data: SepaDirectDebitData): string {
  const messageId = `SWINGZ-${Date.now()}`;
  const creationDate = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${creationDate}T00:00:00Z</CreDtTm>
      <NbOfTxs>${data.payments.length}</NbOfTxs>
      <CtrlSum>${data.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${data.creditorName}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${messageId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${data.payments.length}</NbOfTxs>
      <CtrlSum>${data.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdColltnDt>${data.payments[0]?.executionDate || creationDate}</ReqdColltnDt>
      <Cdtr>
        <Nm>${data.creditorName}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${data.creditorIban}</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <BIC>${data.creditorBic}</BIC>
        </FinInstnId>
      </CdtrAgt>
      <ChrgBr>SHAR</ChrgBr>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${data.creditorId}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>`;

  data.payments.forEach((payment) => {
    xml += `
      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${payment.paymentId}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="${payment.currency}">${payment.amount.toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${payment.mandateId}</MndtId>
            <DtOfSgntr>${payment.mandateDate}</DtOfSgntr>
          </MndtRltdInf>
          <CdtrSchmeId>
            <Id>
              <PrvtId>
                <Othr>
                  <Id>${data.creditorId}</Id>
                  <SchmeNm>
                    <Prtry>SEPA</Prtry>
                  </SchmeNm>
                </Othr>
              </PrvtId>
            </Id>
          </CdtrSchmeId>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            <BIC>${payment.debtorBic || 'NOTPROVIDED'}</BIC>
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${payment.debtorName}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>${payment.debtorIban}</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${payment.description}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`;
  });

  xml += `
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

  return xml;
}

export function validateSepaDirectDebitData(data: SepaDirectDebitData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.creditorId || data.creditorId.length !== 18) {
    errors.push('Creditor ID must be 18 characters');
  }

  if (!data.creditorName || data.creditorName.length > 70) {
    errors.push('Creditor name is required and must be max 70 characters');
  }

  if (!data.creditorIban || !isValidIban(data.creditorIban)) {
    errors.push('Creditor IBAN is invalid');
  }

  if (!data.creditorBic || data.creditorBic.length !== 11) {
    errors.push('Creditor BIC must be 11 characters');
  }

  if (!data.payments || data.payments.length === 0) {
    errors.push('At least one payment is required');
  }

  data.payments.forEach((payment, index) => {
    if (!payment.paymentId) {
      errors.push(`Payment ${index + 1}: Payment ID is required`);
    }

    if (!payment.amount || payment.amount <= 0) {
      errors.push(`Payment ${index + 1}: Amount must be greater than 0`);
    }

    if (!payment.currency || payment.currency.length !== 3) {
      errors.push(`Payment ${index + 1}: Currency must be 3 characters`);
    }

    if (!payment.mandateId) {
      errors.push(`Payment ${index + 1}: Mandate ID is required`);
    }

    if (!payment.mandateDate || !isValidDate(payment.mandateDate)) {
      errors.push(`Payment ${index + 1}: Mandate date is invalid`);
    }

    if (!payment.debtorName || payment.debtorName.length > 70) {
      errors.push(`Payment ${index + 1}: Debtor name is required and must be max 70 characters`);
    }

    if (!payment.debtorIban || !isValidIban(payment.debtorIban)) {
      errors.push(`Payment ${index + 1}: Debtor IBAN is invalid`);
    }

    if (!payment.description || payment.description.length > 140) {
      errors.push(`Payment ${index + 1}: Description is required and must be max 140 characters`);
    }

    if (!payment.executionDate || !isValidDate(payment.executionDate)) {
      errors.push(`Payment ${index + 1}: Execution date is invalid`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidIban(iban: string): boolean {
  const cleanedIban = iban.replace(/\s/g, '').toUpperCase();

  if (cleanedIban.length < 15 || cleanedIban.length > 34) {
    return false;
  }

  const rearranged = cleanedIban.substring(4) + cleanedIban.substring(0, 4);
  const numeric = rearranged
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 65 && code <= 90 ? code - 55 : char;
    })
    .join('');

  let remainder = 0;
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + parseInt(numeric[i], 10)) % 97;
  }

  return remainder === 1;
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export function createSepaDirectDebitData(
  payments: Payment[],
  mandates: SepaMandate[],
  creditorName: string,
  creditorIban: string,
  creditorBic: string,
  creditorId: string
): SepaDirectDebitData {
  const mandateMap = new Map(mandates.map((m) => [m.id, m]));

  return {
    creditorId,
    creditorName,
    creditorIban,
    creditorBic,
    payments: payments.map((payment) => {
      const mandate = mandateMap.get(payment.sepa_mandate_id || '');

      const mandateDate = mandate?.signature_date;
      const executionDate = payment.payment_date;
      const debtorBic = mandate?.bic;

      const paymentData: {
        paymentId: string;
        amount: number;
        currency: string;
        mandateId: string;
        mandateDate: string;
        debtorName: string;
        debtorIban: string;
        debtorBic?: string;
        description: string;
        executionDate: string;
      } = {
        paymentId: payment.payment_number,
        amount: payment.amount,
        currency: 'EUR',
        mandateId: mandate?.mandate_reference || '',
        mandateDate:
          typeof mandateDate === 'string'
            ? mandateDate
            : mandateDate?.toISOString().split('T')[0] || '',
        debtorName: mandate?.account_holder_name || '',
        debtorIban: mandate?.iban || '',
        description: `Payment ${payment.payment_number}`,
        executionDate:
          typeof executionDate === 'string'
            ? executionDate
            : executionDate?.toISOString().split('T')[0] || '',
      };

      if (debtorBic !== null && debtorBic !== undefined) {
        paymentData.debtorBic = debtorBic;
      }

      return paymentData;
    }),
  };
}
