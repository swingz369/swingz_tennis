import { SepaMandate, Payment } from '../types/billing';

export interface SepaDirectDebitTransaction {
  paymentId: string;
  mandateId: string;
  mandateReference: string;
  creditorId: string;
  iban: string;
  bic?: string;
  accountHolderName: string;
  amount: number;
  currency: string;
  paymentDate: string;
  endToEndId?: string;
  remittanceInformation?: string;
}

export interface SepaPain008Config {
  creditorName: string;
  creditorAccountIban: string;
  creditorAccountBic?: string;
  creditorId: string;
  creditorAddress?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  executionDate?: string;
  batchBooking?: boolean;
}

export function generatePain008Xml(
  transactions: SepaDirectDebitTransaction[],
  config: SepaPain008Config
): string {
  const now = new Date();
  const messageId = `SWINGZ-${now.getTime()}`;
  const creationTimestamp = now.toISOString();
  const numberOfTransactions = transactions.length;
  const controlSum = transactions.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2);

  const paymentTypeInformation = `
    <PmtTpInf>
      <SvcLvl>
        <Cd>SEPA</Cd>
      </SvcLvl>
      <LclInstrm>
        <Cd>CORE</Cd>
      </LclInstrm>
      <SeqTp>
        <Cd>RCUR</Cd>
      </SeqTp>
    </PmtTpInf>`;

  const paymentInformation = `
    <PmtInf>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${controlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>
          <Cd>RCUR</Cd>
        </SeqTp>
      </PmtTpInf>
      <ReqdExctnDt>${config.executionDate || formatDate(now)}</ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(config.creditorName)}</Nm>
        ${
          config.creditorAddress
            ? `
        <PstlAdr>
          ${config.creditorAddress.street ? `<StrtNm>${escapeXml(config.creditorAddress.street)}</StrtNm>` : ''}
          ${config.creditorAddress.city ? `<TwnNm>${escapeXml(config.creditorAddress.city)}</TwnNm>` : ''}
          ${config.creditorAddress.postalCode ? `<PstCd>${escapeXml(config.creditorAddress.postalCode)}</PstCd>` : ''}
          ${config.creditorAddress.country ? `<Ctry>${escapeXml(config.creditorAddress.country)}</Ctry>` : ''}
        </PstlAdr>`
            : ''
        }
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${config.creditorAccountIban.replace(/\s/g, '')}</IBAN>
        </Id>
      </DbtrActr>
      ${
        config.creditorAccountBic
          ? `
      <DbtrAgt>
        <FinInstnId>
          <BIC>${config.creditorAccountBic}</BIC>
        </FinInstnId>
      </DbtrAgt>`
          : ''
      }
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchAcctId>
        <Id>
          <Othr>
            <Id>${config.creditorId}</Id>
          </Othr>
        </Id>
      </CdtrSchAcctId>
      ${transactions.map((tx) => generateDirectDebitTransactionInfo(tx)).join('\n')}
    </PmtInf>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${creationTimestamp}</CreDtTm>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${controlSum}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(config.creditorName)}</Nm>
      </InitgPty>
    </GrpHdr>
    ${paymentInformation}
  </CstmrDrctDbtInitn>
</Document>`;

  return xml;
}

function generateDirectDebitTransactionInfo(tx: SepaDirectDebitTransaction): string {
  const endToEndId = tx.endToEndId || `SWINGZ-${tx.paymentId}`;
  const mandateRelatedInformation = `
    <MndtRltdInf>
      <MndtId>${escapeXml(tx.mandateReference)}</MndtId>
      <DtOfSgntr>${formatDate(new Date())}</DtOfSgntr>
      <AmdmntInd>false</AmdmntInd>
    </MndtRltdInf>`;

  const directDebitTransactionInfo = `
    <DrctDbtTxInf>
      <PmtId>
        <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>
      </PmtId>
      <InstdAmt Ccy="${tx.currency}">${tx.amount.toFixed(2)}</InstdAmt>
      <ChrgBr>SLEV</ChrgBr>
      <DrctDbtTx>
        <MndtRltdInf>
          <MndtId>${escapeXml(tx.mandateReference)}</MndtId>
          <DtOfSgntr>${formatDate(new Date())}</DtOfSgntr>
        </MndtRltdInf>
        <CdtrSchAcctId>
          <Id>
            <Othr>
              <Id>${escapeXml(tx.creditorId)}</Id>
            </Othr>
          </Id>
        </CdtrSchAcctId>
      </DrctDbtTx>
      <DbtrAgt>
        <FinInstnId>
          ${tx.bic ? `<BIC>${tx.bic}</BIC>` : '<Othr><Id>NOTPROVIDED</Id></Othr>'}
        </FinInstnId>
      </DbtrAgt>
      <Dbtr>
        <Nm>${escapeXml(tx.accountHolderName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${tx.iban.replace(/\s/g, '')}</IBAN>
        </Id>
      </DbtrAcct>
      ${
        tx.remittanceInformation
          ? `
      <RmtInf>
        <Ustrd>${escapeXml(tx.remittanceInformation)}</Ustrd>
      </RmtInf>`
          : ''
      }
    </DrctDbtTxInf>`;

  return directDebitTransactionInfo;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

export function validatePain008Xml(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!xml.includes('<?xml version="1.0"')) {
    errors.push('Missing XML declaration');
  }

  if (!xml.includes('urn:iso:std:iso:20022:tech:xsd:pain.008.001.02')) {
    errors.push('Invalid or missing Pain.008 namespace');
  }

  if (!xml.includes('<CstmrDrctDbtInitn>')) {
    errors.push('Missing CustomerDirectDebitInitiation element');
  }

  if (!xml.includes('<GrpHdr>')) {
    errors.push('Missing GroupHeader element');
  }

  if (!xml.includes('<PmtInf>')) {
    errors.push('Missing PaymentInformation element');
  }

  if (!xml.includes('<DrctDbtTxInf>')) {
    errors.push('No DirectDebitTransactionInfo elements found');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getPain008FileName(creationDate?: Date): string {
  const date = creationDate || new Date();
  const formattedDate = date.toISOString().split('T')[0].replace(/-/g, '');
  return `SEPA-DD-${formattedDate}.xml`;
}

export function getPain008EmailSubject(transactionCount: number, totalAmount: number): string {
  const formattedAmount = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(totalAmount);

  return `SEPA-Lastschrift Export: ${transactionCount} Zahlungen über ${formattedAmount}`;
}

export function getPain008EmailBody(
  transactionCount: number,
  totalAmount: number,
  executionDate: string,
  creditorName: string
): string {
  const formattedAmount = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(totalAmount);

  const formattedExecutionDate = new Date(executionDate).toLocaleDateString('de-DE');

  return `
Hallo,

anbei erhalten Sie die SEPA-Lastschrift-Datei für ${creditorName}.

Export-Details:
- Anzahl der Zahlungen: ${transactionCount}
- Gesamtbetrag: ${formattedAmount}
- Ausführungsdatum: ${formattedExecutionDate}
- Dateiformat: Pain.008 XML

Bitte laden Sie diese Datei in Ihr Online-Banking hoch, um die Lastschriften auszuführen.

Wichtige Hinweise:
- Prüfen Sie die Datei vor dem Upload sorgfältig
- Stellen Sie sicher, dass alle Mandate gültig sind
- Beachten Sie die Vorlaufzeiten für SEPA-Lastschriften

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr SWINGZ Team
  `.trim();
}
