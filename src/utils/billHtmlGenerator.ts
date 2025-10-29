/**
 * Bill HTML Generation Utility
 * Centralizes bill HTML generation for downloads and viewing
 */
import { format } from "date-fns";

export interface BillData {
  id: string;
  patient_name: string;
  doctor_name: string;
  appointment_date: string;
  service_description: string;
  amount: number;
  tax_amount?: number;
  discount_amount?: number;
  total_amount: number;
  status: string;
  created_at: string;
  clinic_name?: string;
  clinic_address?: string;
  clinic_phone?: string;
  clinic_email?: string;
}

export function generateBillHtml(bill: BillData): string {
  const formattedDate = format(new Date(bill.appointment_date), "PPP");
  const formattedCreatedAt = format(new Date(bill.created_at), "PPP");

  const subtotal = bill.amount;
  const tax = bill.tax_amount || 0;
  const discount = bill.discount_amount || 0;
  const total = bill.total_amount;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Medical Bill - ${bill.id}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .clinic-name {
          font-size: 28px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 10px;
        }
        .clinic-info {
          color: #666;
          font-size: 14px;
        }
        .bill-title {
          font-size: 24px;
          font-weight: bold;
          text-align: center;
          margin: 30px 0;
          color: #1f2937;
        }
        .bill-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }
        .bill-section {
          background-color: #f8fafc;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #2563eb;
        }
        .bill-section h3 {
          margin: 0 0 10px 0;
          color: #374151;
          font-size: 16px;
          font-weight: 600;
        }
        .bill-section p {
          margin: 5px 0;
          font-size: 14px;
        }
        .services-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background-color: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .services-table th {
          background-color: #2563eb;
          color: white;
          padding: 15px;
          text-align: left;
          font-weight: 600;
        }
        .services-table td {
          padding: 15px;
          border-bottom: 1px solid #e5e7eb;
        }
        .services-table tr:last-child td {
          border-bottom: none;
        }
        .amount {
          text-align: right;
          font-weight: 600;
        }
        .total-section {
          margin-top: 30px;
          background-color: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          padding: 5px 0;
        }
        .total-row.final {
          border-top: 2px solid #2563eb;
          margin-top: 15px;
          padding-top: 15px;
          font-size: 18px;
          font-weight: bold;
          color: #1f2937;
        }
        .status {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status.paid {
          background-color: #d1fae5;
          color: #065f46;
        }
        .status.pending {
          background-color: #fef3c7;
          color: #92400e;
        }
        .status.overdue {
          background-color: #fee2e2;
          color: #991b1b;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
        }
        .print-date {
          color: #9ca3af;
          font-size: 12px;
          text-align: right;
          margin-top: 20px;
        }
        @media print {
          body { margin: 0; padding: 15px; }
          .total-section { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="clinic-name">${bill.clinic_name || "AbhiCure Clinic"}</div>
        <div class="clinic-info">
          ${bill.clinic_address || "Medical Center"}<br>
          Phone: ${bill.clinic_phone || "N/A"} | Email: ${
    bill.clinic_email || "contact@abhicure.com"
  }
        </div>
      </div>

      <div class="bill-title">MEDICAL BILL</div>

      <div class="bill-info">
        <div class="bill-section">
          <h3>Bill Information</h3>
          <p><strong>Bill ID:</strong> ${bill.id}</p>
          <p><strong>Date Issued:</strong> ${formattedCreatedAt}</p>
          <p><strong>Status:</strong> <span class="status ${bill.status.toLowerCase()}">${
    bill.status
  }</span></p>
        </div>
        
        <div class="bill-section">
          <h3>Patient Information</h3>
          <p><strong>Patient Name:</strong> ${bill.patient_name}</p>
          <p><strong>Doctor:</strong> Dr. ${bill.doctor_name}</p>
          <p><strong>Appointment Date:</strong> ${formattedDate}</p>
        </div>
      </div>

      <table class="services-table">
        <thead>
          <tr>
            <th>Service Description</th>
            <th>Date</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${bill.service_description}</td>
            <td>${formattedDate}</td>
            <td class="amount">₹${subtotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="total-section">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>₹${subtotal.toFixed(2)}</span>
        </div>
        ${
          discount > 0
            ? `
          <div class="total-row">
            <span>Discount:</span>
            <span>-₹${discount.toFixed(2)}</span>
          </div>
        `
            : ""
        }
        ${
          tax > 0
            ? `
          <div class="total-row">
            <span>Tax (${((tax / subtotal) * 100).toFixed(1)}%):</span>
            <span>₹${tax.toFixed(2)}</span>
          </div>
        `
            : ""
        }
        <div class="total-row final">
          <span>Total Amount:</span>
          <span>₹${total.toFixed(2)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for choosing ${bill.clinic_name || "AbhiCure Clinic"}</p>
        <p>For any billing inquiries, please contact us at ${
          bill.clinic_phone || "clinic phone"
        }</p>
      </div>

      <div class="print-date">
        Generated on: ${format(new Date(), "PPP p")}
      </div>
    </body>
    </html>
  `;
}

/**
 * Download bill as HTML file
 */
export function downloadBillHtml(bill: BillData, filename?: string): void {
  const html = generateBillHtml(bill);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `bill-${bill.id}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Print bill in a new window
 */
export function printBill(bill: BillData): void {
  const html = generateBillHtml(bill);
  const printWindow = window.open("", "_blank");

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }
}
