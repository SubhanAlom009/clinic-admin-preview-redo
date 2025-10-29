import { format } from "date-fns";

export const downloadBillAsHTML = (bill: any) => {
  const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice #${bill.bill_number}</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; 
          padding: 40px; 
          background-color: #f8fafc;
        }
        .invoice-container {
          background: white;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          text-align: center; 
          margin-bottom: 40px; 
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 20px;
        }
        .company-name { 
          font-size: 32px; 
          font-weight: bold; 
          color: #2563eb; 
          margin-bottom: 8px;
        }
        .total-amount {
          font-size: 24px;
          font-weight: bold;
          color: #059669;
          text-align: center;
          margin: 20px 0;
          padding: 15px;
          background: #f0fdf4;
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="company-name">AbhiCure Clinic</div>
          <p>Professional Healthcare Services</p>
          <h2>INVOICE #${bill.bill_number}</h2>
        </div>
        
        <div style="margin: 30px 0;">
          <h3>Bill To:</h3>
          <p><strong>${bill.patient?.name}</strong></p>
          <p>Email: ${bill.patient?.email || "N/A"}</p>
          <p>Phone: ${bill.patient?.phone || "N/A"}</p>
        </div>
        
        <div style="margin: 30px 0;">
          <p><strong>Date:</strong> ${format(
            new Date(bill.created_at),
            "MMMM d, yyyy"
          )}</p>
          <p><strong>Due Date:</strong> ${
            bill.due_date
              ? format(new Date(bill.due_date), "MMMM d, yyyy")
              : "No due date"
          }</p>
          <p><strong>Status:</strong> ${bill.status.toUpperCase()}</p>
        </div>
        
        <div class="total-amount">
          Total Amount: ₹${bill.total_amount.toFixed(2)}
        </div>
        
        <div style="text-center; margin-top: 40px; color: #6b7280;">
          <p><strong>Thank you for choosing AbhiCure Clinic</strong></p>
          <p style="font-size: 12px;">This is a computer-generated invoice.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([invoiceHTML], { type: "text/html" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${bill.bill_number}-${
    bill.patient?.name?.replace(/\s+/g, "-") || "patient"
  }.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
