import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  PDFDownloadLink,
  Font,
} from '@react-pdf/renderer';
import { InvoiceWithItems } from '../types/billing';

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Bold.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 11,
    padding: 40,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
  },
  logo: {
    width: 150,
    height: 50,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: 120,
    color: '#666666',
  },
  value: {
    flex: 1,
    color: '#1a1a1a',
    fontWeight: 500,
  },
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableHeaderCell: {
    flex: 1,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableCell: {
    flex: 1,
    color: '#1a1a1a',
  },
  tableCellRight: {
    flex: 1,
    color: '#1a1a1a',
    textAlign: 'right',
  },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    marginBottom: 5,
    width: 200,
  },
  totalLabel: {
    flex: 1,
    color: '#666666',
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  grandTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  statusText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  statusDraft: { backgroundColor: '#9ca3af' },
  statusSent: { backgroundColor: '#3b82f6' },
  statusPaid: { backgroundColor: '#10b981' },
  statusOverdue: { backgroundColor: '#ef4444' },
  statusCancelled: { backgroundColor: '#6b7280' },
  statusDunning: { backgroundColor: '#f59e0b' },
});

interface InvoicePDFProps {
  invoice: InvoiceWithItems;
  clubName: string;
  clubAddress: string;
  clubEmail: string;
  clubPhone: string;
  memberName: string;
  memberAddress: string;
  memberEmail: string;
}

const InvoicePDF = ({ 
  invoice, 
  clubName, 
  clubAddress, 
  clubEmail, 
  clubPhone,
  memberName,
  memberAddress,
  memberEmail,
}: InvoicePDFProps) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'draft': return styles.statusDraft;
      case 'sent': return styles.statusSent;
      case 'paid': return styles.statusPaid;
      case 'overdue': return styles.statusOverdue;
      case 'cancelled': return styles.statusCancelled;
      case 'dunning': return styles.statusDunning;
      default: return styles.statusDraft;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: invoice.currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>RECHNUNG</Text>
          <Text style={styles.subtitle}>SWINGZ Tennis Club Management</Text>
          
          <View style={[styles.statusBadge, getStatusStyle(invoice.status)]}>
            <Text style={styles.statusText}>
              {invoice.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rechnungsdetails</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Rechnungsnummer:</Text>
            <Text style={styles.value}>{invoice.invoice_number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Rechnungsdatum:</Text>
            <Text style={styles.value}>{formatDate(invoice.invoice_date)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fälligkeitsdatum:</Text>
            <Text style={styles.value}>{formatDate(invoice.due_date)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rechnungssteller</Text>
          <View style={styles.row}>
            <Text style={styles.value}>{clubName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.value}>{clubAddress}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>E-Mail:</Text>
            <Text style={styles.value}>{clubEmail}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefon:</Text>
            <Text style={styles.value}>{clubPhone}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rechnungsempfänger</Text>
          <View style={styles.row}>
            <Text style={styles.value}>{memberName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.value}>{memberAddress}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>E-Mail:</Text>
            <Text style={styles.value}>{memberEmail}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rechnungspositionen</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Beschreibung</Text>
              <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Menge</Text>
              <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Einzelpreis</Text>
              <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>MwSt.</Text>
              <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Gesamt</Text>
            </View>
            
            {invoice.items.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.description}</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>{item.quantity}</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>{formatCurrency(item.unit_price)}</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>{item.tax_rate}%</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>{formatCurrency(item.total_price)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Zwischensumme:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>MwSt. (19%):</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.tax_amount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.totalLabel}>Gesamtbetrag:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.total_amount)}</Text>
          </View>
          {invoice.paid_amount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Bereits bezahlt:</Text>
              <Text style={[styles.totalValue, { color: '#10b981' }]}>
                {formatCurrency(invoice.paid_amount)}
              </Text>
            </View>
          )}
          {invoice.paid_amount < invoice.total_amount && (
            <View style={[styles.totalRow, { marginTop: 10 }]}>
              <Text style={[styles.totalLabel, { fontWeight: 'bold' }]}>Restbetrag:</Text>
              <Text style={[styles.totalValue, { fontWeight: 'bold', color: '#ef4444' }]}>
                {formatCurrency(invoice.total_amount - invoice.paid_amount)}
              </Text>
            </View>
          )}
        </View>

        {invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bemerkungen</Text>
            <Text style={styles.value}>{invoice.notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Vielen Dank für Ihren Beitrag zum SWINGZ Tennis Club!
          </Text>
          <Text style={styles.footerText}>
            Bei Fragen kontaktieren Sie uns unter {clubEmail} oder {clubPhone}
          </Text>
          <Text style={styles.footerText}>
            Rechnung erstellt am {new Date().toLocaleDateString('de-DE')}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoicePDF;

export const InvoiceDownloadLink = ({ 
  invoice, 
  clubName, 
  clubAddress, 
  clubEmail, 
  clubPhone,
  memberName,
  memberAddress,
  memberEmail,
  children,
}: InvoicePDFProps & { children: React.ReactNode }) => (
  <PDFDownloadLink
    document={
      <InvoicePDF
        invoice={invoice}
        clubName={clubName}
        clubAddress={clubAddress}
        clubEmail={clubEmail}
        clubPhone={clubPhone}
        memberName={memberName}
        memberAddress={memberAddress}
        memberEmail={memberEmail}
      />
    }
    fileName={`Rechnung-${invoice.invoice_number}.pdf`}
  >
    {() => children}
  </PDFDownloadLink>
);
