import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Medicine {
    id?: string;
    name: string;
    dosage: string;
}

interface PrescriptionData {
    // Patient Info
    patientName: string;
    patientAge: string;
    patientGender: string;
    patientHeight?: string;
    patientWeight?: string;

    // Medical Data
    symptoms: string;
    diagnosis: string;
    medicines: Medicine[];
    prescriptionNotes: string;

    // Doctor Info
    doctorName: string;
    doctorQualification?: string;
    doctorRegistration?: string;
    doctorSignatureUrl?: string | null;

    // Clinic Info
    clinicName: string;
    clinicAddress?: string;
    clinicPhone?: string;
    clinicEmail?: string;

    // Appointment Info
    appointmentDate: string;
    appointmentId: string;
}

// Helper to fetch image and convert to base64
async function fetchImageAsBase64(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error fetching signature image:", error);
        throw error;
    }
}

export async function generatePrescriptionPDF(data: PrescriptionData): Promise<Blob> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Colors
    const primaryBlue: [number, number, number] = [59, 130, 246];   // Blue-500
    const lightBlue: [number, number, number] = [219, 234, 254];    // Blue-100
    const textDark: [number, number, number] = [30, 41, 59];        // Slate-800
    const textMuted: [number, number, number] = [100, 116, 139];    // Slate-500
    const accentTeal: [number, number, number] = [13, 148, 136];    // Teal-600

    // ===== HEADER BACKGROUND =====
    doc.setFillColor(...lightBlue);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // ===== DOCTOR NAME (Header) =====
    doc.setFontSize(24);
    doc.setTextColor(...primaryBlue);
    doc.setFont('helvetica', 'bold');
    doc.text(data.doctorName || 'Dr. Doctor', margin, 20);

    // Qualification
    doc.setFontSize(11);
    doc.setTextColor(...accentTeal);
    doc.setFont('helvetica', 'normal');
    doc.text(data.doctorQualification?.toUpperCase() || 'GENERAL PHYSICIAN', margin, 28);

    // Registration Number (if available)
    if (data.doctorRegistration) {
        doc.setFontSize(9);
        doc.setTextColor(...textMuted);
        doc.text(`Reg. No: ${data.doctorRegistration}`, margin, 35);
    }

    // Clinic Name on right
    doc.setFontSize(10);
    doc.setTextColor(...textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(data.clinicName || 'Clinic', pageWidth - margin, 20, { align: 'right' });

    // Decorative cross symbol (right side)
    doc.setFillColor(...accentTeal);
    doc.rect(pageWidth - 35, 8, 15, 4, 'F');
    doc.rect(pageWidth - 30, 3, 5, 14, 'F');

    yPos = 55;

    // ===== PATIENT INFO SECTION =====
    doc.setDrawColor(...textMuted);
    doc.setLineWidth(0.3);

    // Patient Name & Date row
    doc.setFontSize(10);
    doc.setTextColor(...textDark);
    doc.setFont('helvetica', 'normal');

    doc.text('Patient Name:', margin, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(data.patientName || '________________', margin + 28, yPos);

    doc.setFont('helvetica', 'normal');
    doc.text('Date:', pageWidth - margin - 50, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(data.appointmentDate || new Date().toLocaleDateString('en-IN'), pageWidth - margin - 35, yPos);

    yPos += 10;

    // Age, Gender, Height, Weight row
    doc.setFont('helvetica', 'normal');
    doc.text('Age:', margin, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(data.patientAge || 'N/A', margin + 10, yPos);

    doc.setFont('helvetica', 'normal');
    doc.text('Gender:', margin + 35, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(data.patientGender || 'N/A', margin + 50, yPos);

    // Height and Weight
    if (data.patientHeight || data.patientWeight) {
        doc.setFont('helvetica', 'normal');
        doc.text('Ht:', margin + 85, yPos);
        doc.setFont('helvetica', 'bold');
        doc.text(data.patientHeight ? `${data.patientHeight} cm` : 'N/A', margin + 93, yPos);

        doc.setFont('helvetica', 'normal');
        doc.text('Wt:', margin + 120, yPos);
        doc.setFont('helvetica', 'bold');
        doc.text(data.patientWeight ? `${data.patientWeight} kg` : 'N/A', margin + 128, yPos);
    }

    yPos += 12;

    // Diagnosis
    if (data.diagnosis) {
        doc.setFont('helvetica', 'normal');
        doc.text('Diagnosis:', margin, yPos);
        doc.setFont('helvetica', 'bold');
        const diagnosisText = doc.splitTextToSize(data.diagnosis, pageWidth - 2 * margin - 25);
        doc.text(diagnosisText, margin + 25, yPos);
        yPos += diagnosisText.length * 5 + 5;
    }

    // Symptoms (if any)
    if (data.symptoms) {
        doc.setFont('helvetica', 'normal');
        doc.text('Symptoms:', margin, yPos);
        doc.setFont('helvetica', 'bold');
        const symptomsText = doc.splitTextToSize(data.symptoms, pageWidth - 2 * margin - 25);
        doc.text(symptomsText, margin + 25, yPos);
        yPos += symptomsText.length * 5 + 5;
    }

    // Divider line
    yPos += 3;
    doc.setDrawColor(...lightBlue);
    doc.setLineWidth(1);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // ===== Rx SECTION =====
    // Large Rx symbol
    doc.setFontSize(40);
    doc.setTextColor(...primaryBlue);
    doc.setFont('helvetica', 'bold');
    doc.text('Rx', margin, yPos + 12);

    yPos += 5;

    // Medicines Table
    if (data.medicines && data.medicines.length > 0) {
        const tableData = data.medicines.map((med, index) => [
            (index + 1).toString(),
            med.name || '-',
            med.dosage || '-'
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['#', 'Medicine / Strength', 'Dosage & Instructions']],
            body: tableData,
            theme: 'plain',
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: primaryBlue,
                fontStyle: 'bold',
                fontSize: 10,
                cellPadding: 3
            },
            bodyStyles: {
                fontSize: 10,
                textColor: textDark,
                cellPadding: 4
            },
            columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 70 },
                2: { cellWidth: 'auto' }
            },
            margin: { left: margin + 20, right: margin },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            }
        });

        yPos = (doc as any).lastAutoTable.finalY + 8;
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...textMuted);
        doc.text('No medicines prescribed.', margin + 25, yPos + 5);
        yPos += 15;
    }

    // Additional Notes
    if (data.prescriptionNotes) {
        yPos += 5;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryBlue);
        doc.text('Instructions:', margin, yPos);
        yPos += 5;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textDark);
        const notesLines = doc.splitTextToSize(data.prescriptionNotes, pageWidth - 2 * margin);
        doc.text(notesLines, margin, yPos);
        yPos += notesLines.length * 5;
    }

    // ===== SIGNATURE SECTION =====
    const signatureY = pageHeight - 50;
    const signatureX = pageWidth - margin - 60;
    const signatureWidth = 60;

    // Draw signature line
    doc.setDrawColor(...textMuted);
    doc.setLineWidth(0.3);
    doc.line(signatureX, signatureY, pageWidth - margin, signatureY);

    // Signature Logic
    let signatureAdded = false;

    if (data.doctorSignatureUrl) {
        try {
            // Fetch image and add
            const base64Img = await fetchImageAsBase64(data.doctorSignatureUrl);
            // Aspect ratio management could be better but keeping it simple
            // Params: data, format, x, y, w, h
            doc.addImage(base64Img, 'PNG', signatureX + 5, signatureY - 15, 50, 15, undefined, 'FAST');
            signatureAdded = true;
        } catch (error) {
            console.error("Failed to embed signature image:", error);
            // Fallback to text handled below
        }
    }

    if (!signatureAdded) {
        // Text signature: Render doctor name in italics (script-like)
        doc.setFontSize(14);
        doc.setTextColor(...primaryBlue);
        doc.setFont('helvetica', 'bolditalic');
        const signatureName = data.doctorName || 'Doctor';
        doc.text(signatureName, signatureX + signatureWidth / 2, signatureY - 3, { align: 'center' });
    }

    // Label
    doc.setFontSize(9);
    doc.setTextColor(...textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text('Authorized Signature', signatureX + signatureWidth / 2, signatureY + 5, { align: 'center' });

    // ===== FOOTER =====
    const footerY = pageHeight - 25;

    // Footer background
    doc.setFillColor(...primaryBlue);
    doc.rect(0, footerY, pageWidth, 25, 'F');

    // Footer content - Line 1: Address
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');

    if (data.clinicAddress) {
        doc.text(`Address: ${data.clinicAddress}`, margin, footerY + 7);
    }

    // Footer content - Line 2: Phone & Branding
    if (data.clinicPhone) {
        doc.text(`Phone: ${data.clinicPhone}`, margin, footerY + 14);
    }

    // Abhicure branding (always shown - right side)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Powered by Abhicure', pageWidth - margin, footerY + 10, { align: 'right' });

    // Appointment ID (small, bottom right)
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${data.appointmentId?.slice(0, 8) || 'N/A'}`, pageWidth - margin, footerY + 17, { align: 'right' });

    // Return as Blob
    return doc.output('blob');
}

// Helper to download the PDF
export async function downloadPrescriptionPDF(data: PrescriptionData, filename?: string): Promise<void> {
    const blob = await generatePrescriptionPDF(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `prescription-${data.appointmentId?.slice(0, 8) || 'rx'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
